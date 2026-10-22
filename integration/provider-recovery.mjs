/** Real isolated daemon + scripted HTTP model provider; no LLM quality claim. */
import { createServer } from "node:http";
import { mkdtemp, writeFile, readFile, copyFile } from "node:fs/promises";
import { openSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
assert(process.env.CODE_STUDIO_DAEMON_BIN, "Set CODE_STUDIO_DAEMON_BIN to the newly built daemon");
const data = await mkdtemp(join(tmpdir(), "studio-provider-recovery-"));
const bin = join(data, basename(process.env.CODE_STUDIO_DAEMON_BIN));
await copyFile(process.env.CODE_STUDIO_DAEMON_BIN, bin);
const report = { at: new Date().toISOString(), data, daemon_sha256: createHash("sha256").update(await readFile(bin)).digest("hex"), provider: "scripted HTTP fixture", cases: [], requests: [] };
let daemon;
let restorePinned = false;
const healthyCalls = new Map();
const fixture = createServer(async (req, res) => {
    if (req.method !== "POST") {
        res.setHeader("Content-Type", "application/json");
        res.end("{}");
        return;
    }
    let input = "";
    for await (const chunk of req)
        input += chunk;
    const body = JSON.parse(input);
    const text = (body.messages ?? []).map(message => JSON.stringify(message.content)).join("\n");
    const pinned = text.includes("CASE:pinned");
    report.requests.push({ at: new Date().toISOString(), model: body.model, pinned });
    if (body.model === "stall" && !(pinned && restorePinned)) {
        res.setHeader("Content-Type", "text/event-stream");
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "TOOL: write_file SHOULD_NOT_EXIST.md unwanted" } }] })}\n\n`);
        // Keep the body open until the daemon cancels this timed out attempt.
        res.on("close", () => report.requests.push({ model: body.model, cancelled: true }));
        return;
    }
    const key = pinned ? "pinned" : "fallback";
    const count = body.tools?.length ? (healthyCalls.get(key) ?? 0) + 1 : 0;
    if (count)
        healthyCalls.set(key, count);
    const delta = count === 1 ? { tool_calls: [{ index: 0, id: `call_${key}`, type: "function", function: { name: "read_file", arguments: JSON.stringify({ path: "DESIGN.md" }) } }] } : { content: "DESIGN.md a été lu. Vérification terminée." };
    if (body.stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.end(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: count === 1 ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`);
    }
    else {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ choices: [{ message: count === 1 ? { tool_calls: delta.tool_calls } : { content: delta.content }, finish_reason: "stop" }] }));
    }
});
await new Promise(resolve => fixture.listen(0, "127.0.0.1", resolve));
const provider = `http://127.0.0.1:${fixture.address().port}`;
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(path, method = "GET", body) { const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) }); const value = await response.json(); assert(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(value)}`); return value; }
async function finished(id) { for (let i = 0; i < 160; i++) {
    const task = await api(`/api/tasks/${id}`);
    if (["completed", "failed", "interrupted", "cancelled"].includes(task.status))
        return task;
    await pause(500);
} throw Error("Task did not terminate within 80 seconds"); }
await writeFile(join(data, "llm_router.yaml"), JSON.stringify({ global: { enable_fallback: true, default_timeout_secs: 34, default_max_retries: 0 }, providers: { openai: { base_url: provider + "/v1", api_key_ref: "fixture-not-secret" }, ollama: { base_url: "http://127.0.0.1:1" } }, task_types: Object.fromEntries(["code_generation", "conversation", "system", "utility", "orchestrator"].map(key => [key, { primary: { provider: "openai", model: key === "code_generation" ? "stall" : "healthy" }, fallback: key === "code_generation" ? [{ provider: "openai", model: "healthy" }] : [] }])) }));
await writeFile(join(data, "tools_policy.yaml"), JSON.stringify({ allowed_read_paths: [data], allowed_write_paths: [data], allowed_commands: ["git"], command_timeout_secs: 5, run_command_default_cwd_workspace: true }));
await writeFile(join(data, "permissions_mode.json"), JSON.stringify({ mode: "allow_all" }));
try {
    const log = openSync(join(data, "daemon.log"), "a");
    daemon = spawn(bin, [], { cwd: resolve(process.env.AKASHA_REPO_DIR ?? "../Akasha"), windowsHide: true, stdio: ["ignore", log, log], env: { ...process.env, AKASHA_DATA_DIR: data, AKASHA_PORT: String(port), OPENAI_API_KEY: "fixture-not-secret", OLLAMA_HOST: "http://127.0.0.1:1", AKASHA_STUDIO_KANBAN_DISPATCH_ENABLED: "0", AKASHA_STUDIO_SEMANTIC_VERIFY: "0", AKASHA_MAX_TOOL_ROUNDS: "4", AKASHA_LLM_TIMEOUT_SECS: "34" } });
    let ready = false;
    for (let i = 0; i < 80; i++) {
        try {
            await api("/api/status");
            ready = true;
            break;
        }
        catch {
            await pause(250);
        }
    }
    assert(ready, "daemon not ready");
    const project = await api("/api/studio/projects", "POST", { name: "Provider recovery fixture" });
    assert(project.id, JSON.stringify(project));
    async function start(key, pinned) {
        const response = await api(`/api/studio/projects/${project.id}/tickets`, "POST", { title: `Audit ${key}`, description: "Lire DESIGN.md", assigned_agent: "studio_planner", review_agent: "studio_reviewer", acceptance_criteria: [{ id: "design", text: "Design exists", kind: "file_exists", path: "DESIGN.md" }] });
        const ticket = response.ticket ?? response;
        assert(ticket.id, JSON.stringify(response));
        const sent = await api("/api/message", "POST", { session_id: `provider-${key}`, studio_project_id: project.id, studio_ticket_id: ticket.id, studio_code_mode: "plan", studio_delegate_single_level: true, message: `CASE:${key} Lis DESIGN.md avec read_file puis rapporte son titre. Ne modifie aucun fichier.`, ...(pinned ? { studio_model: { provider: "openai", model: "stall" } } : {}) });
        return { id: sent.task_id, ticket: ticket.id };
    }
    const fallback = await start("fallback", false);
    const recovered = await finished(fallback.id);
    const events = (await api(`/api/tasks/${fallback.id}/events`)).events;
    assert.equal(recovered.status, "completed", JSON.stringify(recovered));
    assert(recovered.outcome.successful_tool_calls >= 1);
    assert.equal(recovered.outcome.failed_tool_calls, 0, "abandoned partial output must not enter tool dispatch");
    assert(!JSON.stringify(events.filter(event => event.event_type.startsWith("tool"))).includes("SHOULD_NOT_EXIST"));
    assert(events.some(event => event.event_type === "llm_provider_attempt" && event.payload.phase === "fallback" && event.payload.model === "healthy"));
    assert(events.some(event => event.event_type === "llm_wait_heartbeat"));
    assert.equal(report.requests.filter(request => request.model === "stall" && !request.pinned && !request.cancelled).length, 1, "failed primary is not retried on each tool round");
    assert(!(await api(`/api/studio/projects/${project.id}/files`)).files.some(path => path.includes("SHOULD_NOT_EXIST")), "discarded partial output must not execute tools");
    report.cases.push({ name: "fallback with heartbeat and no partial tool execution", task: fallback.id, status: recovered.status, events });
    const pinned = await start("pinned", true);
    const failed = await finished(pinned.id);
    assert.equal(failed.status, "failed");
    assert.equal(failed.outcome.termination_reason, "timeout");
    const tickets = (await api(`/api/studio/projects/${project.id}/tickets`)).items;
    assert.equal(tickets.find(ticket => ticket.id === pinned.ticket).status, "blocked");
    const failureReport = await api(`/api/tasks/${pinned.id}/report`);
    assert.deepEqual(failureReport.done, []);
    assert.equal(failureReport.failed.length, 1);
    const failureEvents = (await api(`/api/tasks/${pinned.id}/events`)).events;
    assert(!failureEvents.some(event => event.event_type === "timeline_milestone" && event.payload.name === "first_meaningful_progress"));
    assert(!report.requests.some(request => request.pinned && request.model === "healthy"));
    restorePinned = true;
    await api(`/api/tasks/${pinned.id}/resume`, "POST");
    const resumed = await finished(pinned.id);
    assert.equal(resumed.status, "completed", JSON.stringify(resumed));
    const after = (await api(`/api/studio/projects/${project.id}/tickets`)).items;
    assert.equal(after.length, tickets.length);
    assert.equal(after.find(ticket => ticket.id === pinned.ticket).related_task_id, pinned.id);
    report.cases.push({ name: "pinned timeout, blocked ticket, truthful report and same-task resume", task: pinned.id, failed, resumed });
    report.status = "passed";
}
catch (error) {
    report.status = "failed";
    report.error = error.stack;
    process.exitCode = 1;
    console.error(error);
}
finally {
    if (daemon && daemon.exitCode === null) {
        daemon.kill();
        await Promise.race([new Promise(resolve => daemon.once("exit", resolve)), pause(3000)]);
    }
    fixture.closeAllConnections();
    fixture.close();
    await writeFile(join(data, "report.json"), JSON.stringify(report, null, 2));
    console.log("EVIDENCE", join(data, "report.json"));
}
