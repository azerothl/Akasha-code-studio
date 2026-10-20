/** Opt-in real Ollama validation. Uses an isolated daemon, project and data directory. */
import { mkdtemp, writeFile, readFile, copyFile } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const source = process.env.CODE_STUDIO_DAEMON_BIN;
assert(source, "Set CODE_STUDIO_DAEMON_BIN to the built daemon");
const model = process.env.CODE_STUDIO_REAL_MODEL ?? "qwen2.5-coder:14b";
const ollama = process.env.CODE_STUDIO_OLLAMA_URL ?? "http://127.0.0.1:11434";
const data = await mkdtemp(join(tmpdir(), "studio-real-goal-"));
const bin = join(data, basename(source));
await copyFile(source, bin);
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const report = { at: new Date().toISOString(), model, data, status: "running" };
const defaultPolicy = process.env.CODE_STUDIO_TEST_DEFAULT_POLICY === "1";
report.policy = defaultPolicy ? "web-only config, inherited Studio defaults" : "explicit fixture paths";
await writeFile(join(data, "llm_router.yaml"), JSON.stringify({
  global: { enable_fallback: false, default_timeout_secs: 90, default_max_retries: 0 },
  providers: { ollama: { base_url: ollama } },
  task_types: Object.fromEntries(["conversation", "code_generation", "system", "utility", "orchestrator", "system_diagnostic"].map(name => [name, { primary: { provider: "ollama", model, config: { num_ctx: 16384, max_tokens: 2048, temperature: 0 } }, fallback: [] }])),
}));
await writeFile(join(data, "tools_policy.yaml"), JSON.stringify(defaultPolicy ? { web_search_enabled: false, allowed_web_domains: ["doc.rust-lang.org"] } : { allowed_read_paths: [data], allowed_write_paths: [data], allowed_commands: ["git"], command_timeout_secs: 10 }));
const log = openSync(join(data, "daemon.log"), "a");
const daemon = spawn(bin, [], { cwd: data, windowsHide: true, stdio: ["ignore", log, log], env: { ...process.env, AKASHA_DATA_DIR: data, AKASHA_PORT: String(port), AKASHA_MAX_TOOL_ROUNDS: "10", AKASHA_STUDIO_VERIFY_MAX_PASSES: "1", AKASHA_STUDIO_VERIFY_AUTOFIX_LLM_ROUNDS: "0", AKASHA_STUDIO_VERIFY_EXPLAIN_FAILURE: "0" } });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(path, method = "GET", body) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  const text = await response.text(); assert(response.ok, `${response.status}: ${text}`); return text ? JSON.parse(text) : {};
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await api("/api/status"); ready = true; break; } catch { await sleep(250); }
  }
  assert(ready, "Isolated daemon did not become ready");
  const catalog = await api("/api/router/studio-options");
  assert(catalog.models.some(choice => choice.provider === "ollama" && choice.model === model));
  const project = await api("/api/studio/projects", "POST", { name: "Real goal validation", tech_stack: "fichier texte" });
  const message = "Crée uniquement le fichier GOAL-REAL.txt à la racine du projet. Son contenu doit être exactement la ligne real-goal-ok. Utilise les outils de fichiers, puis termine sans effectuer d’autre changement.";
  const sent = await api("/api/message", "POST", { session_id: "real-goal-validation", message, studio_project_id: project.id, studio_delegate_single_level: true, studio_action: "goal", studio_model: { provider: "ollama", model }, studio_goal: { objective: message, criteria: { criteria: [{ id: "file", kind: "file_exists", text: "GOAL-REAL.txt présent", path: "GOAL-REAL.txt" }] }, max_cycles: 3, max_seconds: 120, max_tokens: 50000 } });
  report.task_id = sent.task_id;
  const started = Date.now();
  while (Date.now() - started < 150000) {
    const task = await api(`/api/tasks/${sent.task_id}`);
    if (["completed", "failed", "cancelled", "paused", "interrupted", "waiting_user_input"].includes(task.status)) { report.task = task; break; }
    await sleep(500);
  }
  assert(report.task, "Real-model task exceeded the validation deadline");
  report.goal = await api(`/api/tasks/${sent.task_id}/goal`);
  report.elapsed_ms = Date.now() - started;
  assert.equal(report.task.status, "completed", JSON.stringify(report.task.outcome));
  assert.equal(report.goal.state, "completed");
  const content = await readFile(join(data, "studio-projects", project.id, "GOAL-REAL.txt"), "utf8");
  assert.equal(content.trim(), "real-goal-ok");
  assert(report.task.last_turn_model_used?.includes(model), "Observed model differs from the requested model");
  report.content = content;
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.error = error.stack; process.exitCode = 1;
  console.error(error);
} finally {
  if (daemon.exitCode === null && daemon.signalCode === null) {
    const exited = new Promise(resolve => daemon.once("exit", resolve)); daemon.kill();
    await Promise.race([exited, sleep(3000)]);
  }
  closeSync(log);
  await writeFile(join(data, "report.json"), JSON.stringify(report, null, 2));
  console.log("EVIDENCE", join(data, "report.json"));
}
