/** Real daemon/files/processes/Chromium/LSP integration. The model wire is a deterministic
 * local OpenAI-compatible fixture: this verifies execution, not model intelligence.
 * Requires CODE_STUDIO_DAEMON_BIN and sibling Akasha (or AKASHA_REPO_DIR).
 * Evidence and isolated daemon data are retained in the OS temp folder.
 */
import { createServer } from "node:http";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  unlink,
  rename,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, delimiter } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const repo = resolve(process.env.AKASHA_REPO_DIR ?? "../Akasha");
const bin = process.env.CODE_STUDIO_DAEMON_BIN;
assert(bin, "Set CODE_STUDIO_DAEMON_BIN to the built daemon executable");
const data = await mkdtemp(join(tmpdir(), "studio-agentic-real-"));
const report = {
  at: new Date().toISOString(),
  data,
  daemon_sha256: createHash("sha256").update(await readFile(bin)).digest("hex"),
  model: "deterministic protocol fixture (not an LLM evaluation)",
  cases: [],
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const scripts = new Map();
const requests = [];
let daemon;
let ui;
let browser;
let base;
let project;
const server = createServer(async (req, res) => {
  if (req.url === "/demo") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<h1>Real browser fixture</h1><input aria-label="Name"><button onclick="document.querySelector(\'h1\').textContent=\'Clicked\'">Run</button><script>console.log("fixture console");fetch("/health")</script>',
    );
    return;
  }
  if (req.url === "/redirect") {
    res.writeHead(302, { Location: "http://localhost:1/blocked" });
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Content-Type", "application/json");
    res.end("{}");
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const text =
    body.messages
      ?.map((m) =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      )
      .join("\n") ?? "";
  const markers = text.match(/CASE:([a-zA-Z0-9_-]+)/g) ?? [];
  const match = [...scripts.keys()].find((key) =>
    markers.includes(`CASE:${key}`),
  );
  const sequence = body.tools?.length ? scripts.get(match) : undefined;
  const next = sequence?.length
    ? sequence.shift()
    : { text: "Validation terminée." };
  try {
    if (typeof next.args === "function") next.args = next.args(text);
    if (next.verify) await next.verify(text, body);
  } catch (error) {
    report.fixtureError = String(error);
    res.writeHead(500);
    res.end("Protocol fixture assertion failed");
    return;
  }
  requests.push({
    case: match,
    native: Boolean(body.tools?.length),
    response: next,
  });
  if (next.delay) await pause(next.delay);
  if (next.error) {
    res.writeHead(next.error);
    res.end("fixture provider error");
    return;
  }
  const tool = next.tool;
  const delta = tool
    ? {
        tool_calls: [
          {
            index: 0,
            id: "call_fixture",
            type: "function",
            function: {
              name: next.nativeName ?? "studio_call",
              arguments: JSON.stringify(next.nativeName ? next.args : {
                schema_version: 1,
                operation_id: next.id ?? randomUUID(),
                tool,
                arguments: next.args,
              }),
            },
          },
        ],
      }
    : { content: next.text ?? "" };
  if (body.stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: tool ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            message: tool
              ? { tool_calls: delta.tool_calls }
              : { content: next.text ?? "" },
            finish_reason: tool ? "tool_calls" : "stop",
          },
        ],
        model: "fixture",
      }),
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const fixture = `http://127.0.0.1:${server.address().port}`;
const portServer = createServer();
await new Promise((r) => portServer.listen(0, "127.0.0.1", r));
const port = portServer.address().port;
await new Promise((r) => portServer.close(r));
base = `http://127.0.0.1:${port}`;
await writeFile(
  join(data, "llm_router.yaml"),
  JSON.stringify({
    global: {
      enable_fallback: false,
      default_timeout_secs: 20,
      default_max_retries: 0,
    },
    providers: {
      openai: { base_url: fixture + "/v1", api_key_ref: "fixture-not-secret" },
      ollama: { base_url: "http://127.0.0.1:1" },
    },
    task_types: Object.fromEntries(
      [
        "conversation",
        "code_generation",
        "system",
        "utility",
        "orchestrator",
        "system_diagnostic",
      ].map((k) => [
        k,
        { primary: { provider: "openai", model: "fixture" }, fallback: [] },
      ]),
    ),
  }),
);
await writeFile(
  join(data, "tools_policy.yaml"),
  JSON.stringify({
    allowed_read_paths: [data],
    allowed_write_paths: [data],
    allowed_commands: [
      "git",
      "gh",
      "node",
      "cmd",
      "powershell",
      "typescript-language-server",
      "pyright-langserver",
      "rust-analyzer",
    ],
    command_timeout_secs: 15,
    mcp_max_calls_per_task: 1,
    browser_enabled: true,
    browser_allowed_domains: ["127.0.0.1"],
    browser_headless: true,
    browser_action_timeout_secs: 5,
    run_command_default_cwd_workspace: true,
  }),
);
await writeFile(
  join(data, "permissions_mode.json"),
  JSON.stringify({ mode: "allow_all" }),
);
await writeFile(
  join(data, "mcp-fixture.mjs"),
  `import{createInterface}from'node:readline';import{appendFileSync}from'node:fs';const rl=createInterface({input:process.stdin});rl.on('line',line=>{const q=JSON.parse(line);if(q.id===undefined)return;let result;if(q.method==='initialize')process.stdout.write('\\n'+JSON.stringify({jsonrpc:'2.0',method:'notifications/message',params:{level:'info',data:'initializing'}})+'\\n');if(q.method==='initialize')result={protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};else if(q.method==='tools/list')result=q.params?.cursor?{tools:[{name:'second',description:'second page',inputSchema:{type:'object',properties:{},additionalProperties:false}}]}:{tools:[{name:'echo',description:'echo checked text',inputSchema:{type:'object',required:['text'],properties:{text:{type:'string'}},additionalProperties:false}}],nextCursor:'page2'};else if(q.method==='tools/call'){appendFileSync(${JSON.stringify(join(data, "mcp-calls.txt"))},JSON.stringify(q.params)+'\\n');result={content:[{type:'text',text:q.params.arguments.text??'second'}]};}else result={};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:q.id,result})+'\\n');});`,
);
await writeFile(
  join(data, "mcp.json"),
  JSON.stringify({
    mcpServers: {
      fixture: { command: "node", args: [join(data, "mcp-fixture.mjs")] },
    },
  }),
);
const log = await import("node:fs").then((fs) =>
  fs.openSync(join(data, "daemon.log"), "a"),
);
const daemonEnv = {
  ...process.env,
  AKASHA_DATA_DIR: data,
  AKASHA_PORT: String(port),
  OPENAI_API_KEY: "fixture-not-secret",
  OLLAMA_HOST: "http://127.0.0.1:1",
  AKASHA_PLAYWRIGHT_AUTO_INSTALL: "0",
  AKASHA_PLAYWRIGHT_RUNNER: join(repo, "scripts/playwright-runner/run.mjs"),
  AKASHA_MAX_TOOL_ROUNDS: "16",
  AKASHA_STUDIO_VERIFY_MAX_PASSES: "1",
  AKASHA_STUDIO_VERIFY_AUTOFIX_LLM_ROUNDS: "0",
  AKASHA_STUDIO_VERIFY_EXPLAIN_FAILURE: "0",
  PATH: [
    process.env.STUDIO_LSP_BIN ??
      join(tmpdir(), "studio-agentic-lsp-tools/node_modules/.bin"),
    process.env.PATH,
  ].join(delimiter),
};
function start() {
  daemon = spawn(bin, [], {
    cwd: repo,
    env: daemonEnv,
    stdio: ["ignore", log, log],
    windowsHide: true,
  });
}
async function ready() {
  for (let i = 0; i < 90; i++) {
    try {
      if (
        (
          await fetch(base + "/api/status", {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      )
        return;
    } catch {}
    await pause(500);
  }
  throw Error("Daemon startup timeout: " + data);
}
async function api(path, method = "GET", body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(65000),
  });
  const raw = await response.text();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${raw.slice(0, 1500)}`,
  );
  return raw ? JSON.parse(raw) : {};
}
async function check(name, fn) {
  const at = Date.now();
  try {
    const evidence = await fn();
    report.cases.push({
      name,
      status: "passed",
      ms: Date.now() - at,
      evidence,
    });
    console.log("PASS", name);
  } catch (e) {
    report.cases.push({ name, status: "failed", error: e.stack });
    throw e;
  } finally {
    await writeFile(join(data, "report.json"), JSON.stringify(report, null, 2));
  }
}
async function task(key, sequence, agent = "studio_scaffold", extra = {}) {
  scripts.set(key, [...sequence]);
  const sent = await api("/api/message", "POST", {
    session_id: "validation-" + key,
    studio_project_id: project.id,
    studio_assigned_agent: agent,
    studio_delegate_single_level: true,
    ...(agent === "studio_planner" ? { studio_code_mode: "plan" } : {}),
    message: `CASE:${key} Exécute uniquement la recette de validation demandée puis termine.`,
    ...extra,
  });
  assert(sent.task_id);
  return sent.task_id;
}
async function finished(id) {
  let row;
  for (let i = 0; i < 180; i++) {
    row = await api("/api/tasks/" + id);
    if (
      [
        "completed",
        "failed",
        "cancelled",
        "paused",
        "interrupted",
        "waiting_user_input",
      ].includes(row.status)
    ) {
      (report.tasks ??= []).push(row);
      return row;
    }
    await pause(250);
  }
  throw Error("Task timeout " + JSON.stringify(row));
}
async function waitUntil(fn, label, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const result = await fn();
    if (result) return result;
    await pause(75);
  }
  throw Error(`Timeout: ${label}`);
}
async function restart() {
  daemon.kill();
  await new Promise((resolve) => daemon.once("exit", resolve));
  start();
  await ready();
}
async function checkpointed(id) {
  return waitUntil(async () => {
    const value = await api(`/api/tasks/${id}/recovery`);
    return value.checkpoint && value;
  }, "checkpoint " + id);
}
async function inactive(id) {
  return waitUntil(async () => !(await api(`/api/tasks/${id}/recovery`)).execution_active, "inactive " + id);
}
const tool = (name, args, id) => ({ tool: name, args, id });
const fileArgs = (path, content) => ({
  path: "workspace:/" + path,
  content,
  expected_version: "missing",
});
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
try {
  start();
  await ready();
  await check("real project creation and clean initial Git", async () => {
    project = await api(
      "/api/studio/projects",
      "POST",
      {
        name: "Agentic validation",
        tech_stack: "fichier texte",
        project_summary: "Isolated integration test",
      },
      201,
    );
    report.project = project;
    const root = join(data, "studio-projects", project.id);
    assert.equal(git(root, "status", "--porcelain"), "");
    return { id: project.id, head: git(root, "rev-parse", "HEAD") };
  });
  const root = join(data, "studio-projects", project.id);
  await check(
    "TypeScript build failure stays failed when Vite fallback succeeds",
    async () => {
      const previous = project;
      try {
        project = await api(
          "/api/studio/projects",
          "POST",
          { name: "Build truth", tech_stack: "TypeScript Vite" },
          201,
        );
        const buildRoot = join(data, "studio-projects", project.id);
        await symlink(
          resolve("node_modules"),
          join(buildRoot, "node_modules"),
          process.platform === "win32" ? "junction" : "dir",
        );
        await writeFile(
          join(buildRoot, "package.json"),
          JSON.stringify({
            name: "build-truth",
            private: true,
            type: "module",
            scripts: { build: "tsc --noEmit && vite build" },
          }),
        );
        await writeFile(
          join(buildRoot, "tsconfig.json"),
          JSON.stringify({
            compilerOptions: {
              target: "ES2020",
              module: "ESNext",
              moduleResolution: "bundler",
              skipLibCheck: true,
              types: [],
              noEmit: true,
            },
            include: ["main.ts"],
          }),
        );
        await writeFile(
          join(buildRoot, "index.html"),
          '<script type="module" src="/main.ts"></script>',
        );
        await writeFile(
          join(buildRoot, "main.ts"),
          'const bad: number = "intentional TS2322"; document.body.textContent = String(bad);',
        );
        const id = await task("build-truth", [
          { text: "La modification demandée est terminée." },
        ]);
        const row = await finished(id);
        assert.equal(row.status, "failed");
        assert.equal(row.outcome.termination_reason, "verification_failed");
        assert.equal(row.outcome.acceptance_verified, false);
        assert(
          row.outcome.verification.some(
            (check) =>
              check.kind === "project_build" && check.status === "failed",
          ),
        );
        assert.match(row.failure_detail, /Vite fallback passed/);
        assert.match(
          await readFile(join(buildRoot, "dist/index.html"), "utf8"),
          /assets/,
        );
        return { id, outcome: row.outcome, failure: row.failure_detail };
      } finally {
        project = previous;
      }
    },
  );
  await check("empty model fails without inventing verification", async () => {
    const id = await task("empty", [{ text: "" }], "studio_scaffold", {
      studio_delegate_single_level: false,
    });
    const row = await finished(id);
    assert.equal(row.status, "failed");
    assert.equal(row.outcome?.termination_reason, "model_empty");
    assert.equal(row.outcome.acceptance_verified, false);
    return { id, outcome: row.outcome };
  });
  await check("file creation prose without any effect cannot become a success", async () => {
    const id=await task("no-effect-claim",Array.from({length:4},()=>({text:"Le fichier demandé a été créé."})),"studio_scaffold",{message:"Crée uniquement NEVER-NO-EFFECT.md avec la ligne proof. CASE:no-effect-claim"});
    const row=await finished(id);
    assert.equal(row.status,"failed");
    assert.equal(row.outcome.termination_reason,"tool_error");
    assert.equal(row.outcome.successful_tool_calls,0);
    assert.equal(await readFile(join(root,"NEVER-NO-EFFECT.md"),"utf8").catch(()=>null),null);
    return {id,outcome:row.outcome};
  });
  await check("explicit literal mismatch has no disk effect and is corrected by a new tool request", async () => {
    const id=await task("literal-content",[
      tool("write_file",fileArgs("literal-case.txt","Token-42")),
      {...tool("write_file",fileArgs("literal-case.txt","token-42")),verify:async (_text,body)=>{
        assert.equal(await readFile(join(root,"literal-case.txt"),"utf8").catch(()=>null),null);
        const output=body.messages.filter(m=>m.role==="tool").at(-1).content;
        assert(output.includes("explicit_content_mismatch") && output.includes("token-42"));
      }},
      {text:"Fichier créé avec le contenu exact."},
    ],"studio_scaffold",{message:"Crée literal-case.txt avec exactement token-42. CASE:literal-content"});
    const row=await finished(id);
    assert.equal(row.status,"completed");
    assert.equal(row.outcome.failed_tool_calls,1);
    assert.equal(row.outcome.successful_tool_calls,1);
    assert.equal(row.outcome.acceptance_verified,false);
    assert.equal(await readFile(join(root,"literal-case.txt"),"utf8"),"token-42");
    return {id,outcome:row.outcome};
  });
  await check("one empty creation generation retries before effects while persistent emptiness remains failed", async () => {
    const id=await task("empty-retry",[
      {text:""},tool("write_file",fileArgs("empty-retry.txt","ok")),{text:"Fichier créé."},
    ],"studio_scaffold",{message:"Crée empty-retry.txt avec exactement ok. CASE:empty-retry"});
    const row=await finished(id);
    assert.equal(row.status,"completed");assert.equal(row.outcome.successful_tool_calls,1);
    assert.equal(row.outcome.verification.filter(c=>c.kind==="empty_generation_retry").length,1);
    assert.equal(row.outcome.acceptance_verified,false);
    const failed=await task("empty-retry-exhausted",[{text:""},{text:""}],"studio_scaffold",{message:"Crée empty-exhausted.txt avec exactement no. CASE:empty-retry-exhausted"});
    const exhausted=await finished(failed);
    assert.equal(exhausted.status,"failed");assert.equal(exhausted.outcome.termination_reason,"model_empty");
    assert.equal(exhausted.outcome.successful_tool_calls,0);
    assert.equal(await readFile(join(root,"empty-exhausted.txt"),"utf8").catch(()=>null),null);
    const durable=await task("empty-retry-restart",[{text:""},{text:"",delay:30000}],"studio_scaffold",{message:"Crée empty-durable.txt avec exactement no. CASE:empty-retry-restart"});
    await waitUntil(async()=>requests.filter(r=>r.case==="empty-retry-restart").length===2,"retry request checkpointed before crash");
    await restart();
    scripts.set("empty-retry-restart",[{text:""}]);
    await api(`/api/tasks/${durable}/resume`,"POST",{});
    const resumed=await finished(durable);
    assert.equal(resumed.status,"failed");assert.equal(resumed.outcome.termination_reason,"model_empty");
    assert.equal(requests.filter(r=>r.case==="empty-retry-restart").length,3,"Restart must not grant another empty retry");
    assert.equal(resumed.outcome.successful_tool_calls,0);
    return {id,outcome:row.outcome,persistent_empty:exhausted.outcome,durable_retry:resumed.outcome};
  });
  await check("a literal-invalid batch defers dependent effects and keeps distinct call results", async () => {
    const batch=(last)=>JSON.stringify([
      {name:"studio_call",arguments:{schema_version:1,tool:"write_file",arguments:fileArgs("batch-first.txt","un")}},
      {name:"studio_call",arguments:{schema_version:1,tool:"read_file",arguments:{path:"workspace:/batch-first.txt"}}},
      {name:"studio_call",arguments:{schema_version:1,tool:"write_file",arguments:fileArgs("batch-second.txt",last)}},
    ]);
    const id=await task("literal-batch",[
      {text:batch("Deux")},
      {text:batch("deux"),verify:async (_text,body)=>{
        for (const path of ["batch-first.txt","batch-second.txt"]) assert.equal(await readFile(join(root,path),"utf8").catch(()=>null),null);
        const results=body.messages.filter(m=>m.role==="tool");
        assert.equal(results.length,3);
        assert(results[0].content.includes("batch_deferred") && !results[0].content.includes("explicit_content_mismatch"));
        assert(results[2].content.includes("explicit_content_mismatch") && !results[2].content.includes("batch_deferred"));
      }},
      {text:"Les deux fichiers sont créés après lecture intermédiaire."},
    ],"studio_scaffold",{message:"Crée batch-first.txt avec exactement un. Puis lis batch-first.txt. Ensuite crée batch-second.txt avec exactement deux. CASE:literal-batch"});
    const row=await finished(id);
    assert.equal(row.status,"completed");
    assert.equal(row.outcome.failed_tool_calls,3);
    assert.equal(row.outcome.successful_tool_calls,3);
    assert.equal(await readFile(join(root,"batch-second.txt"),"utf8"),"deux");
    return {id,outcome:row.outcome};
  });
  await check("direct file context retains repository rules and project constraints without maintenance examples", async () => {
    const previous=project;
    const item=await api("/api/studio/projects","POST",{name:"Scoped context",tech_stack:"fichier texte",project_summary:"Isolated context selection"},201);
    project=item;
    const scopedRoot=join(data,"studio-projects",project.id);
    try {
      await writeFile(join(scopedRoot,"AGENTS.md"),"SCOPED_REPOSITORY_RULE: preserve KEEP.txt.\n");
      await writeFile(join(scopedRoot,"KEEP.txt"),"keep\n");
      await writeFile(join(scopedRoot,"CODE_STUDIO_PLAN.md"),"# Title\n## Scope\nPRESERVED_SCOPE\n## Stack\nfichier texte\n## Fichiers hors scope\nKEEP.txt\n## Demandes d'évolutions utilisateur par phase\nMAINTENANCE_EXAMPLE_BAIT\n");
      execFileSync("git",["add","AGENTS.md","KEEP.txt","CODE_STUDIO_PLAN.md"],{cwd:scopedRoot});
      execFileSync("git",["-c","user.name=Studio validation","-c","user.email=studio-validation@localhost","commit","-m","context fixture"],{cwd:scopedRoot});
      const id=await task("scoped-context",[
        {...tool("write_file",fileArgs("FOCUSED.md","exact")),verify:(_text,body)=>{
          const initial=body.messages.find(m=>m.role==="user").content;
          assert(initial.includes("[Direct file task — explicit paths]"));
          assert(initial.includes("PRESERVED_SCOPE") && initial.includes("KEEP.txt"));
          assert(initial.includes("SCOPED_DESIGN_CONSTRAINT"));
          assert(!initial.includes("MAINTENANCE_EXAMPLE_BAIT"));
          assert(body.messages[0].content.includes("SCOPED_REPOSITORY_RULE"));
        }},
        {text:"Réponse interrompue.",delay:30000},
      ],"studio_scaffold",{message:"Crée FOCUSED.md avec exactement exact. CASE:scoped-context",studio_delegate_single_level:true,studio_design_doc:"SCOPED_DESIGN_CONSTRAINT: preserve KEEP.txt."});
      await waitUntil(async()=>{const r=await api(`/api/tasks/${id}/recovery`);return r.checkpoint?.round>=1&&r;},"scoped checkpoint");
      await restart();
      scripts.set("scoped-context",[{text:"Fichier créé.",verify:(_text,body)=>{
        assert(body.messages[0].content.includes("direct file execution mode"),"The selected direct mode must survive daemon restart");
        assert(body.messages.some(m=>m.role==="user" && m.content.includes("SCOPED_DESIGN_CONSTRAINT")));
      }}]);
      await api(`/api/tasks/${id}/resume`,"POST",{});
      assert.equal((await finished(id)).status,"completed");
      assert.equal(await readFile(join(scopedRoot,"FOCUSED.md"),"utf8"),"exact");
      assert.equal(await readFile(join(scopedRoot,"KEEP.txt"),"utf8"),"keep\n");
      return {id};
    } finally {project=previous;}
  });
  await check("native continuation ends in tool results without a new continue user turn", async () => {
    const id=await task("native-turns",[
      {...tool("write_file",fileArgs("native-turns.md","turns\n")),verify:(_text,body)=>{
        const initial=body.messages.find(m=>m.role==="user").content;
        assert(!initial.includes("the user is asking about transport routes"),"A Studio task must not receive the travel no-write reminder");
      }},
      {...tool("read_file",{path:"workspace:/native-turns.md"}),verify:(_text,body)=>{
        assert.equal(body.messages.at(-1).role,"tool");
        assert.equal(body.messages.filter(m=>m.role==="user").length,1);
        assert.equal(body.messages.at(-2).tool_calls[0].id,body.messages.at(-1).tool_call_id);
      }},
      {text:"Fichier écrit et relu.",verify:(_text,body)=>{
        assert.equal(body.messages.at(-1).role,"tool");
        assert.equal(body.messages.filter(m=>m.role==="user").length,1);
        assert.equal(body.messages.filter(m=>m.role==="tool").length,2);
      }},
    ]);
    assert.equal((await finished(id)).status,"completed");
    return {id};
  });
  await check("advertised native functions preserve bytes and call identity while unknown functions have no effect", async () => {
    const id=await task("native-functions",[
      {...tool("write_file",fileArgs("native-function.txt","exact-é")),nativeName:"write_file",verify:(_text,body)=>{
        const names=body.tools.map(t=>t.function.name);
        assert(names.includes("write_file") && names.includes("read_file") && !names.includes("studio_call"));
      }},
      {...tool("read_file",{path:"workspace:/native-function.txt"}),nativeName:"read_file",verify:(_text,body)=>{
        const assistant=body.messages.findLast(m=>m.tool_calls?.length);
        const result=body.messages.findLast(m=>m.role==="tool");
        assert.equal(assistant.tool_calls[0].function.name,"write_file");
        assert.equal(assistant.tool_calls[0].id,result.tool_call_id);
        assert.equal(JSON.parse(assistant.tool_calls[0].function.arguments).content,"exact-é");
      }},
      {text:"Fichier créé et relu."},
    ],"studio_scaffold",{message:"Crée native-function.txt avec exactement exact-é. Puis lis native-function.txt. CASE:native-functions"});
    const row=await finished(id);assert.equal(row.status,"completed");assert.equal(row.outcome.successful_tool_calls,2);
    assert.equal(await readFile(join(root,"native-function.txt"),"utf8"),"exact-é");
    const invalid=await task("native-unknown",[{...tool("write_file",fileArgs("unknown-native.txt","wrong")),nativeName:"not_advertised"}],"studio_scaffold",{message:"Crée unknown-native.txt. CASE:native-unknown"});
    const rejected=await finished(invalid);assert.equal(rejected.status,"failed");assert.equal(rejected.outcome.termination_reason,"provider_error");
    assert.equal(rejected.outcome.successful_tool_calls,0);assert.equal(await readFile(join(root,"unknown-native.txt"),"utf8").catch(()=>null),null);
    return {id,outcome:row.outcome,rejected:rejected.outcome};
  });
  await check("JSON content function requests execute both wrapped and native Devstral reads in order", async () => {
    const variants=[];
    for (const name of ["studio_call","read_file"]) {
      const key="json-read-"+name, first="json-first-"+name+".md", second="json-second-"+name+".md";
      const read={path:"workspace:/"+first};
      const id=await task(key,[
        tool("write_file",fileArgs(first,"alpha")),
        {text:JSON.stringify([{name,arguments:name==="studio_call"?{schema_version:1,tool:"read_file",arguments:read}:read}])},
        {...tool("write_file",fileArgs(second,"beta")),verify:(_text,body)=>{
          assert.equal(body.messages.at(-1).role,"tool");
          assert(body.messages.at(-1).content.includes("alpha"));
          const previous=body.messages.at(-2).tool_calls[0].function;
          assert.equal(previous.name,"read_file");
          assert.equal(JSON.parse(previous.arguments).path,"workspace:/"+first);
          assert.equal(body.messages.at(-2).content,"");
        }},
        {text:"Écriture, lecture puis seconde écriture terminées."},
      ]);
      const row=await finished(id);assert.equal(row.status,"completed",JSON.stringify(row));
      const operations=(await api(`/api/tasks/${id}/recovery`)).ledger.operations.filter(o=>o.result?.success).sort((a,b)=>a.updated_at.localeCompare(b.updated_at));
      assert.deepEqual(operations.map(o=>o.tool),["write_file","read_file","write_file"]);
      variants.push({name,id,operations});
    }
    return {variants};
  });
  await check("malformed JSON function arguments never execute or become a success", async () => {
    const id=await task("json-invalid",[
      {text:JSON.stringify({name:"studio_call",arguments:{schema_version:1,tool:"write_file",arguments:{path:"workspace:/INVALID-JSON.md",content:"never"}}})},
      {text:"Terminé."},
    ]);
    const row=await finished(id);
    assert.equal(row.status,"failed");
    assert.equal(row.outcome.termination_reason,"tool_error");
    assert.equal(await readFile(join(root,"INVALID-JSON.md"),"utf8").catch(()=>null),null);
    return {id,outcome:row.outcome};
  });
  await check("premature final response resumes only the explicitly missing file", async () => {
    const id=await task("missing-deliverable",[
      tool("write_file",fileArgs("FIRST-REQUIRED.md","one\n")),
      {text:"Tout est terminé."},
      {...tool("write_file",fileArgs("SECOND-REQUIRED.md","two\n")),verify:(_text,body)=>{
        assert.equal(body.messages.at(-1).role,"user");
        assert.equal(body.tool_choice,"required");
        assert(body.messages.at(-1).content.includes("[Pending physical deliverables]"));
        assert(body.messages.at(-1).content.includes("SECOND-REQUIRED.md"));
      }},
      {text:"Les deux fichiers demandés sont présents.",verify:(_text,body)=>{
        assert.notEqual(body.tool_choice,"required","The repair turn must not force extra calls after the missing file was written");
      }},
    ],"studio_scaffold",{message:"Crée FIRST-REQUIRED.md. Ensuite crée SECOND-REQUIRED.md. CASE:missing-deliverable"});
    const row=await finished(id);assert.equal(row.status,"completed",JSON.stringify(row));
    assert.equal(await readFile(join(root,"FIRST-REQUIRED.md"),"utf8"),"one\n");
    assert.equal(await readFile(join(root,"SECOND-REQUIRED.md"),"utf8"),"two\n");
    assert.equal(row.outcome.verification.filter(c=>c.kind==="requested_file"&&c.status==="passed").length,2);
    assert.equal(row.outcome.acceptance_verified,false,"Presence is not full content/acceptance validation");
    return {id,outcome:row.outcome};
  });
  await check(
    "native reads continue after the default 500-line window",
    async () => {
      await writeFile(
        join(root, "large-read.txt"),
        Array.from({ length: 700 }, (_, i) => `LINE_${i + 1}`).join("\n"),
      );
      const id = await task("read-window", [
        tool("read_file", { path: "workspace:/large-read.txt" }),
        {
          tool:"read_file",args:{path:"workspace:/large-read.txt",limit_lines:1},
          verify:(text)=>assert(text.includes("read_file partial")),
        },
        {
          tool:"read_file",args:{path:"workspace:/large-read.txt",offset_line:501},
          verify:(_text,body)=>{
            const result=JSON.parse(body.messages.at(-1).content.split("\n")[1]);
            assert.equal(result.success,true);
            assert.match(result.output,/\blines 1\.\.1\b/);
            assert.match(result.output,/\nLINE_1$/);
            assert(!result.output.includes("LINE_2"));
          },
        },
        {
          tool: "read_file",
          args: {
            path: "workspace:/large-read.txt",
            offset_line: 501,
            limit_lines: 4,
          },
          verify: (_text,body) => assert(body.messages.at(-1).content.includes("LINE_700")),
        },
        {
          tool: "read_file",
          args: { path: "workspace:/large-read.txt", full: true },
          verify: (text) => assert(text.includes("LINE_501")),
        },
        { text: "Lecture complète terminée." },
      ]);
      const row = await finished(id);
      assert.equal(row.status, "completed", JSON.stringify(row));
      assert.equal(row.outcome.failed_tool_calls, 0);
      assert.equal(row.outcome.successful_tool_calls,5);
      return { id, outcome: row.outcome };
    },
  );
  await check(
    "mechanical acceptance preserves each criterion result",
    async () => {
      const id = await task(
        "criteria",
        [{ text: "Contrôles demandés terminés." }],
        "studio_scaffold",
        {
          studio_acceptance_criteria: {
            criteria: [
              {
                id: "present",
                text: "Plan exists",
                kind: "file_exists",
                path: "CODE_STUDIO_PLAN.md",
              },
              {
                id: "missing",
                text: "Missing fixture",
                kind: "file_exists",
                path: "MUST_NOT_EXIST.txt",
              },
            ],
          },
        },
      );
      const row = await finished(id);
      assert.equal(row.status, "failed");
      assert.equal(
        row.outcome.verification.find((c) => c.id === "present").status,
        "passed",
      );
      assert.equal(
        row.outcome.verification.find((c) => c.id === "missing").status,
        "failed",
      );
      return { id, outcome: row.outcome };
    },
  );
  await check(
    "provider failure keeps explicit structured failure",
    async () => {
      const id = await task("provider-error", [{ error: 503 }]);
      const row = await finished(id);
      assert.equal(row.status, "failed");
      assert.equal(row.outcome.termination_reason, "provider_error");
      return { id, outcome: row.outcome };
    },
  );
  await check(
    "native Unicode write, partial failure and retained diff",
    async () => {
      const id = await task("partial", [
        tool("write_file", fileArgs("proof.md", "réel 🙂\n")),
        { text: "" },
      ]);
      const row = await finished(id);
      assert.equal(row.status, "failed");
      assert.equal(row.outcome?.termination_reason, "model_empty");
      assert.equal(row.outcome.result, "partial");
      assert.equal(await readFile(join(root, "proof.md"), "utf8"), "réel 🙂\n");
      const diff = await api(`/api/tasks/${id}/studio-diff`);
      assert(diff.files.some((f) => f.path === "proof.md"));
      return { id, outcome: row.outcome, diff };
    },
  );
  await check("reviewer and planner refuse command effects", async () => {
    for (const agent of ["studio_reviewer", "studio_planner"]) {
      const key = agent;
      const sequence = [
        tool("run_command", {
          program: "node",
          args: ["-e", "require('fs').writeFileSync('FORBIDDEN.txt','bad')"],
        }),
        { text: "Fin de la revue." },
      ];
      let id;
      if (agent === "studio_reviewer") {
        scripts.set("review-child", sequence);
        const parent = await task(key, [
          {
            text: "TOOL: delegate_to_agent studio_reviewer CASE:review-child Effectue la revue demandée.",
          },
          { text: "Revue terminée." },
        ]);
        await finished(parent);
        const all = await api("/api/tasks");
        const children = Array.isArray(all) ? all : (all.tasks ?? []);
        const child = children.find(
          (t) => t.parent_task_id === parent && t.assigned_agent === agent,
        );
        assert(child, "Reviewer child must be persisted");
        id = child.id ?? child.task_id;
      } else {
        id = await task(key, sequence, agent);
      }
      const row = await finished(id);
      assert.equal(
        await readFile(join(root, "FORBIDDEN.txt"), "utf8").catch(() => null),
        null,
      );
      const manifest = await api(
        `/api/tools/effective?project_id=${project.id}&task_id=${id}`,
      );
      assert.equal(manifest.agent, agent);
      assert(
        !manifest.tools.some((t) => t.name === "run_command" && t.allowed),
      );
      await api(
        `/api/tools/effective?task_id=${id}&agent=studio_fullstack`,
        "GET",
        undefined,
        400,
      );
      assert(row.outcome.failed_tool_calls > 0);
    }
    return "No marker written; persisted roles and spoof refusal confirmed";
  });
  await check("planner writes only exact plan path", async () => {
    const planVersion = createHash("sha256")
      .update(await readFile(join(root, "CODE_STUDIO_PLAN.md")))
      .digest("hex");
    const id = await task(
      "plan",
      [
        tool("write_file", fileArgs("source.ts", "forbidden")),
        tool("read_file", { path: "workspace:/CODE_STUDIO_PLAN.md" }),
        tool("write_file", {
          path: "workspace:/CODE_STUDIO_PLAN.md",
          content: "# Plan de validation\n",
          expected_version: planVersion,
        }),
        { text: "Plan terminé." },
      ],
      "studio_planner",
    );
    const row = await finished(id);
    assert.equal(
      await readFile(join(root, "source.ts"), "utf8").catch(() => null),
      null,
    );
    assert.match(
      await readFile(join(root, "CODE_STUDIO_PLAN.md"), "utf8"),
      /Plan de validation/,
    );
    return { id, status: row.status, outcome: row.outcome };
  });
  await check(
    "real user PTY input, cursor, resize, isolation and close",
    async () => {
      const path = `/api/studio/projects/${project.id}/terminal/sessions`;
      const created = await api(path, "POST", { cols: 80, rows: 24 });
      const sid = created.session_id;
      const legacy = await api("/api/terminal/pty/sessions");
      assert(!legacy.some((session) => session.session_id === sid));
      await api(
        `/api/terminal/pty/sessions/${sid}/output`,
        "GET",
        undefined,
        404,
      );
      await api(
        `/api/terminal/pty/sessions/${sid}/input`,
        "POST",
        { text: "MUST_BE_DENIED\r" },
        404,
      );
      await api(`/api/terminal/pty/sessions/${sid}`, "DELETE", undefined, 404);
      await api(`${path}/${sid}/input`, "POST", { text: "echo PTY_REAL_OK\r" });
      let out;
      for (let i = 0; i < 40; i++) {
        out = await api(`${path}/${sid}/output?cursor=0`);
        if (
          Buffer.from(out.data_b64 ?? "", "base64")
            .toString()
            .includes("PTY_REAL_OK")
        )
          break;
        await pause(100);
      }
      assert(
        Buffer.from(out.data_b64, "base64").toString().includes("PTY_REAL_OK"),
      );
      await api(`${path}/${sid}/resize`, "POST", { cols: 100, rows: 30 });
      const other = await api(
        "/api/studio/projects",
        "POST",
        { name: "PTY other", tech_stack: "texte" },
        201,
      );
      await api(
        `/api/studio/projects/${other.id}/terminal/sessions/${sid}/input`,
        "POST",
        { text: "bad\r" },
        400,
      );
      await api(path + "/" + sid, "DELETE");
      await api(`/api/studio/projects/${other.id}?force=1`, "DELETE");
      return { sid, outputBytes: out.bytes };
    },
  );
  await check(
    "agent PTY remains task-owned and archives its transcript",
    async () => {
      let sid;
      const session = (text) => {
        const found = text
          .replaceAll("\\", "")
          .match(/"session_id"\s*:\s*"([a-f0-9-]{36})"/i);
        if (found) sid = found[1];
        assert(
          sid,
          "Agent terminal session must be in the structured tool result",
        );
        return sid;
      };
      const id = await task("agent-pty", [
        tool("terminal_session", { argv: ["start"] }),
        tool("terminal_session", (text) => ({
          argv: [
            "write",
            session(text),
            JSON.stringify({ text: "echo AGENT_PTY_REAL_OK\r" }),
          ],
        })),
        {
          tool: "terminal_session",
          delay: 500,
          args: (text) => ({ argv: ["read", session(text)] }),
        },
        {
          tool: "terminal_session",
          args: (text) => ({ argv: ["stop", session(text)] }),
          verify: async (text) => {
            await api(
              `/api/studio/projects/${project.id}/terminal/sessions/${session(text)}/input`,
              "POST",
              { text: "MUST_BE_DENIED\r" },
              400,
            );
          },
        },
        { text: "Terminal agent terminé." },
      ]);
      const row = await finished(id);
      assert.equal(row.outcome.failed_tool_calls, 0, JSON.stringify(row));
      const artifacts = await api(`/api/tasks/${id}/artifacts`);
      const transcript = artifacts.artifacts.find(
        (a) => a.kind === "terminal_transcript",
      );
      assert(transcript, JSON.stringify(artifacts));
      const content = await api(`/api/tasks/${id}/artifacts/${transcript.id}`);
      const text = Buffer.from(content.data_base64, "base64").toString();
      assert.match(text, /AGENT_PTY_REAL_OK/);
      assert(!text.includes("MUST_BE_DENIED"));
      return { id, transcript };
    },
  );
  await check(
    "MCP real stdio pagination validation and task invocation",
    async () => {
      await api("/api/mcp/runtime/stdio/start", "POST", { server: "fixture" });
      const list = await api("/api/mcp/runtime/tools/list", "POST", {});
      assert.equal(list.result.tools.length, 2);
      await api(
        "/api/mcp/runtime/tools/call",
        "POST",
        { name: "echo", arguments: { text: 42 } },
        500,
      );
      assert.equal(
        await readFile(join(data, "mcp-calls.txt"), "utf8").catch(() => ""),
        "",
      );
      const id = await task("mcp", [
        tool("mcp_fixture_echo", { text: 42 }),
        tool("mcp_fixture_echo", { text: "MCP_REAL_OK" }),
        { text: "MCP terminé." },
      ]);
      const row = await finished(id);
      assert(row.outcome.successful_tool_calls > 0);
      assert.match(
        await readFile(join(data, "mcp-calls.txt"), "utf8"),
        /MCP_REAL_OK/,
      );
      const policyPath = join(data, "tools_policy.yaml");
      const originalPolicy = await readFile(policyPath, "utf8");
      try {
        await writeFile(
          policyPath,
          JSON.stringify({
            ...JSON.parse(originalPolicy),
            default_profile: "read-only",
            tool_profiles: { "read-only": ["read_file"] },
          }),
        );
        await api("/api/tools/reload", "POST", {});
        const restricted = await api(
          `/api/tools/effective?project_id=${project.id}`,
        );
        assert.equal(
          restricted.tools.find((t) => t.name === "mcp_fixture_echo").allowed,
          false,
        );
        const blocked = await task("mcp-profile", [
          tool("mcp_fixture_echo", { text: "MUST_BE_DENIED" }),
          { text: "Refus constaté." },
        ]);
        const blockedRow = await finished(blocked);
        assert(blockedRow.outcome.failed_tool_calls > 0);
        assert(
          !(await readFile(join(data, "mcp-calls.txt"), "utf8")).includes(
            "MUST_BE_DENIED",
          ),
        );
        await writeFile(
          policyPath,
          JSON.stringify({
            ...JSON.parse(originalPolicy),
            default_profile: "none",
            tool_profiles: { none: [] },
          }),
        );
        await api("/api/tools/reload", "POST", {});
        const empty = await task("empty-profile", [
          { text: "Aucun outil requis." },
        ]);
        assert.equal((await finished(empty)).status, "completed");
        const emptyRequests = requests.filter(
          (request) => request.case === "empty-profile",
        );
        assert(
          emptyRequests.length > 0 &&
            emptyRequests.every((request) => !request.native),
          "Empty profiles must omit native function definitions",
        );
      } finally {
        await writeFile(policyPath, originalPolicy);
        await api("/api/tools/reload", "POST", {});
      }
      await api("/api/mcp/runtime/stdio/stop", "POST", {});
      const manifest = await api(
        `/api/tools/effective?project_id=${project.id}`,
      );
      assert(
        !manifest.tools.some(
          (t) => t.name === "mcp_fixture_echo" && t.runnable,
        ),
      );
      return { id, discovered: list.result.tools.map((t) => t.name) };
    },
  );
  await check(
    "agent browser desktop mobile logs PNG and denied redirect",
    async () => {
      const id = await task("browser", [
        tool("browser", { argv: ["navigate", fixture + "/demo"] }),
        tool("browser", { argv: ["screenshot"] }),
        tool("browser", { argv: ["viewport", "390", "844"] }),
        tool("browser", { argv: ["screenshot"] }),
        tool("browser", { argv: ["console"] }),
        tool("browser", { argv: ["network"] }),
        tool("browser", { argv: ["navigate", fixture + "/redirect"] }),
        tool("browser", { argv: ["navigate", fixture + "/demo"] }),
        {
          tool: "browser",
          args: { argv: ["snapshot"] },
          verify: (text) => assert(text.includes("Navigated")),
        },
        { text: "Observation terminée." },
      ]);
      const row = await finished(id);
      const artifacts = await api(`/api/tasks/${id}/artifacts`);
      assert(
        artifacts.artifacts.some((a) => a.mime === "image/png"),
        JSON.stringify(row),
      );
      assert(artifacts.artifacts.some((a) => a.kind === "browser_console"));
      assert(artifacts.artifacts.some((a) => a.kind === "browser_network"));
      assert(row.outcome.failed_tool_calls >= 1);
      const png = artifacts.artifacts.find((a) => a.mime === "image/png");
      const bytes = await api(`/api/tasks/${id}/artifacts/${png.id}`);
      const image = Buffer.from(bytes.data_base64, "base64");
      assert.equal(image.subarray(1, 4).toString(), "PNG");
      await writeFile(join(data, "agent-browser.png"), image);
      return { id, outcome: row.outcome, artifacts };
    },
  );
  await check(
    "TypeScript real server diagnostics definition references rename",
    async () => {
      await mkdir(join(root, "node_modules"), { recursive: true });
      await symlink(
        resolve("node_modules/typescript"),
        join(root, "node_modules/typescript"),
        process.platform === "win32" ? "junction" : "dir",
      );
      await writeFile(
        join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: { strict: true, target: "ES2020" },
          include: ["*.ts"],
        }),
      );
      await writeFile(
        join(root, "sample.ts"),
        "export const value: number = 1;\nconsole.log(value);\n",
      );
      const path = `/api/studio/projects/${project.id}/lsp`;
      const query = (body) =>
        api(path + "/query", "POST", body).then(
          (value) => value.result ?? value,
        );
      const def = await query({
        action: "definition",
        path: "sample.ts",
        position: { line: 1, character: 13 },
      });
      assert(def.locations.length > 0);
      const refs = await query({
        action: "references",
        path: "sample.ts",
        position: { line: 0, character: 14 },
      });
      assert(refs.locations.length >= 2);
      const plan = await query({
        action: "rename",
        path: "sample.ts",
        position: { line: 0, character: 14 },
        new_name: "renamedValue",
      });
      assert.equal(plan.status, "planned");
      assert.equal(
        await readFile(join(root, "sample.ts"), "utf8"),
        "export const value: number = 1;\nconsole.log(value);\n",
      );
      const applied = await api(
        `${path}/rename/${plan.plan_id}/apply`,
        "POST",
        {},
      );
      assert.equal(applied.status, "applied");
      assert.match(
        await readFile(join(root, "sample.ts"), "utf8"),
        /renamedValue/,
      );
      await writeFile(join(root, "sample.ts"), 'const bad: number = "text";\n');
      let diag;
      for (let i = 0; i < 8; i++) {
        diag = await query({ action: "diagnostics", path: "sample.ts" });
        if (diag.status === "ready" && diag.diagnostics?.length) break;
        await pause(500);
      }
      assert(diag.diagnostics.length > 0);
      await api(path + "/sessions", "DELETE");
      return { definition: def, references: refs, diagnostics: diag };
    },
  );
  await check(
    "Python real server navigation and explicit diagnostics",
    async () => {
      await writeFile(join(root, "sample.py"), "value = 1\nprint(value)\n");
      const path = `/api/studio/projects/${project.id}/lsp`;
      const query = (body) =>
        api(path + "/query", "POST", body).then((v) => v.result ?? v);
      const definition = await query({
        action: "definition",
        path: "sample.py",
        position: { line: 1, character: 7 },
      });
      assert(definition.locations.length > 0, JSON.stringify(definition));
      await writeFile(join(root, "sample.py"), 'value: int = "text"\n');
      let diagnostics;
      for (let i = 0; i < 8; i++) {
        diagnostics = await query({ action: "diagnostics", path: "sample.py" });
        if (diagnostics.status === "ready" && diagnostics.diagnostics?.length)
          break;
        await pause(500);
      }
      assert(diagnostics.diagnostics?.length > 0, JSON.stringify(diagnostics));
      await api(path + "/sessions", "DELETE");
      return { definition, diagnostics };
    },
  );
  await check(
    "Rust real server definition with build scripts disabled",
    async () => {
      await writeFile(
        join(root, "Cargo.toml"),
        '[package]\nname="studio_lsp_validation"\nversion="0.0.0"\nedition="2021"\nbuild="build.rs"\n[lib]\npath="lsp-sample.rs"\n',
      );
      await writeFile(
        join(root, "build.rs"),
        'fn main() { std::fs::write("LSP_BUILD_SCRIPT_MUST_NOT_RUN", "bad").unwrap(); }',
      );
      const line = "pub fn use_value() -> u32 { value() }";
      await writeFile(
        join(root, "lsp-sample.rs"),
        "pub fn value() -> u32 { 1 }\n" + line + "\n",
      );
      const path = `/api/studio/projects/${project.id}/lsp`;
      let definition;
      let lastError;
      const definitionDeadline=Date.now()+45000;
      while(Date.now()<definitionDeadline) {
        try {
          const value = await api(path + "/query", "POST", {
            action: "definition",
            path: "lsp-sample.rs",
            position: { line: 1, character: line.lastIndexOf("value()") + 2 },
          });
          definition = value.result;
          if (definition.locations?.length) break;
        } catch (error) {
          lastError = String(error);
        }
        await pause(500);
      }
      assert(
        definition?.locations?.length > 0,
        JSON.stringify({ definition, lastError }),
      );
      assert.equal(
        await readFile(
          join(root, "LSP_BUILD_SCRIPT_MUST_NOT_RUN"),
          "utf8",
        ).catch(() => null),
        null,
      );
      await api(path + "/sessions", "DELETE");
      await unlink(join(root, "Cargo.toml"));
      return { definition, buildScriptExecuted: false };
    },
  );
  await check(
    "recursive search rules are active before the next mutation and skills are auditable",
    async () => {
      await writeFile(
        join(root, "AGENTS.md"),
        "ROOT_RULE_VALIDATION: instructions for this isolated test workspace.\n",
      );
      await mkdir(join(root, "nested"), { recursive: true });
      await writeFile(
        join(root, "nested/AGENTS.md"),
        "NESTED_RULE_VALIDATION: inspect this instruction before editing the nested fixture.\n",
      );
      const op = randomUUID();
      await writeFile(
        join(root, "nested/inspect.txt"),
        "UNIQUE_RECURSIVE_READ_PROOF\n",
      );
      const id = await task("rules-skills", [
        tool("grep_content", {
          argv: ["workspace:/", "UNIQUE_RECURSIVE_READ_PROOF"],
        }),
        {
          tool: "write_file",
          args: fileArgs("nested/note.md", "rules respected\n"),
          id: op,
          verify: (text) => {
            const rule = text.indexOf("NESTED_RULE_VALIDATION");
            const result = text.indexOf("inspect.txt:1:");
            assert(
              rule >= 0 && result > rule,
              "Nested instructions must precede recursive file contents",
            );
          },
        },
        { text: "TOOL: read_skill studio-explore", verify: async (text) => {
          assert(text.includes("NESTED_RULE_VALIDATION"));
          assert.equal(await readFile(join(root,"nested/note.md"),"utf8"),"rules respected\n");
        } },
        { text: "Règles et skill lus." },
      ]);
      const row = await finished(id);
      assert.equal(row.status, "completed", JSON.stringify(row));
      assert.equal(
        await readFile(join(root, "nested/note.md"), "utf8"),
        "rules respected\n",
      );
      const manifest = await api(
        `/api/tools/effective?project_id=${project.id}&task_id=${id}`,
      );
      assert(
        manifest.active_context.rules.some((rule) =>
          rule.path.replaceAll("\\", "/").endsWith("nested/AGENTS.md"),
        ),
      );
      assert(
        manifest.active_context.skills.some(
          (skill) =>
            skill.name === "studio-explore" && skill.sha256?.length === 64,
        ),
      );
      return { id, context: manifest.active_context };
    },
  );
  await check("fresh nested rules defer mutations until the model has read them", async () => {
    const id=await task("fresh-rules",[
      tool("write_file",fileArgs("nested/deferred.md","safe\n")),
      {tool:"write_file",args:fileArgs("nested/deferred.md","safe\n"),verify:async(text)=>{
        assert(text.includes("NESTED_RULE_VALIDATION"));
        assert.equal(await readFile(join(root,"nested/deferred.md"),"utf8").catch(()=>null),null);
      }},
      {text:"Nested rules respected."}
    ]);
    const row=await finished(id);assert.equal(row.status,"completed",JSON.stringify(row));
    assert.equal(await readFile(join(root,"nested/deferred.md"),"utf8"),"safe\n");return {id};
  });
  await check(
    "rename loads destination rules when its directory contains spaces",
    async () => {
      await mkdir(join(root, "spaced target"), { recursive: true });
      await writeFile(
        join(root, "spaced target/AGENTS.md"),
        "SPACED_DESTINATION_RULE: inspect before moving into this directory.\n",
      );
      await writeFile(join(root, "to-move.md"), "move once\n");
      const op = randomUUID();
      const args = {
        argv: ["workspace:/to-move.md", "workspace:/spaced", "target/moved.md"],
      };
      const id = await task("rename-rules", [
        tool("rename_path", args, op),
        {
          tool: "rename_path",
          args,
          id: op,
          verify: async (text) => {
            assert(text.includes("SPACED_DESTINATION_RULE"));
            assert.equal(
              await readFile(join(root, "to-move.md"), "utf8"),
              "move once\n",
            );
          },
        },
        { text: "Déplacement terminé." },
      ]);
      const row = await finished(id);
      assert.equal(row.status, "completed", JSON.stringify(row));
      assert.equal(
        await readFile(join(root, "spaced target/moved.md"), "utf8"),
        "move once\n",
      );
      return { id };
    },
  );
  await check(
    "selected commit preserves unrelated staged paths and idempotency",
    async () => {
      const id = await task(
        "delivery",
        [{ text: "Préparation terminée." }],
        "studio_reviewer",
      );
      await finished(id);
      git(root, "config", "user.name", "Studio validation");
      git(root, "config", "user.email", "studio-validation@example.invalid");
      await writeFile(join(root, "selected.txt"), "selected\n");
      await writeFile(join(root, "unrelated.txt"), "unrelated\n");
      git(root, "add", "--", "unrelated.txt");
      const expected = createHash("sha256").update("selected\n").digest("hex");
      const operation_id = randomUUID();
      const request = {
        task_id: id,
        operation_id,
        request: {
          paths: ["selected.txt"],
          expected_versions: { "selected.txt": expected },
          expected_head: git(root, "rev-parse", "HEAD"),
          message: "test: isolated selected commit",
        },
      };
      const path = `/api/studio/projects/${project.id}/delivery/commit`;
      const result = await api(path, "POST", request);
      assert.equal(result.result.success, true, JSON.stringify(result));
      const head = git(root, "rev-parse", "HEAD");
      assert.equal(
        git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", head),
        "selected.txt",
      );
      assert.equal(
        git(root, "diff", "--cached", "--name-only"),
        "unrelated.txt",
      );
      const cached = await api(path, "POST", request);
      assert.equal(cached.cached, true);
      assert.equal(git(root, "rev-parse", "HEAD"), head);
      await mkdir(join(root, "normalized"), { recursive: true });
      await writeFile(join(root, "normalized/path.txt"), "normalized\n");
      await writeFile(join(root, "IGNORED_VALIDATION.txt"), "ignored\n");
      await writeFile(
        join(root, ".git/info/exclude"),
        "IGNORED_VALIDATION.txt\n",
      );
      const normalizedRequest = {
        task_id: id,
        operation_id: randomUUID(),
        request: {
          paths: ["normalized\\path.txt", "IGNORED_VALIDATION.txt"],
          expected_versions: {
            "normalized\\path.txt": createHash("sha256")
              .update("normalized\n")
              .digest("hex"),
            "IGNORED_VALIDATION.txt": createHash("sha256")
              .update("ignored\n")
              .digest("hex"),
          },
          expected_head: head,
          message: "must not omit ignored selection",
        },
      };
      const ignored = await fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedRequest),
      });
      assert.equal(ignored.status, 200);
      assert.equal((await ignored.json()).result.success, false);
      assert.equal(git(root, "rev-parse", "HEAD"), head);
      normalizedRequest.operation_id = randomUUID();
      normalizedRequest.request.paths = ["normalized\\path.txt"];
      delete normalizedRequest.request.expected_versions[
        "IGNORED_VALIDATION.txt"
      ];
      const normalized = await api(path, "POST", normalizedRequest);
      assert.equal(normalized.result.success, true, JSON.stringify(normalized));
      assert.equal(git(root, "show", "HEAD:normalized/path.txt"), "normalized");
      assert.equal(
        git(root, "diff", "--cached", "--name-only"),
        "unrelated.txt",
      );
      return { id, head, result, cached };
    },
  );
  await check(
    "task manifest loads skills and rules from its persisted Git worktree",
    async () => {
      const id = await task(
        "worktree-manifest",
        [{ text: "Préparation terminée." }],
        "studio_reviewer",
      );
      await finished(id);
      const suffix = id.replaceAll("-", "").slice(0, 8);
      const worktreeBranch = `wt/${id.replaceAll("-", "")}/${suffix}`;
      const worktree = join(data, "studio-worktrees", id, suffix);
      await mkdir(join(data, "studio-worktrees", id), { recursive: true });
      git(root, "worktree", "add", "-b", worktreeBranch, worktree, "HEAD");
      await mkdir(join(worktree, ".agents/skills/worktree-only"), {
        recursive: true,
      });
      await writeFile(
        join(worktree, ".agents/skills/worktree-only/SKILL.md"),
        "---\nname: worktree-only\ndescription: Visible only in the task worktree.\n---\nRead this task worktree before making changes.\n",
      );
      await writeFile(
        join(worktree, "AGENTS.md"),
        "WORKTREE_MANIFEST_RULE: use the task branch instructions.\n",
      );
      const registry = join(data, "studio-worktrees/registry.json");
      const previous = await readFile(registry, "utf8").catch(() => "[]");
      try {
        await writeFile(
          registry,
          JSON.stringify([
            ...JSON.parse(previous),
            {
              task_id: id,
              root_task_id: id,
              project_id: project.id,
              project_root: root,
              base_branch: "main",
              base_sha: git(root, "rev-parse", "HEAD"),
              worktree_branch: worktreeBranch,
              worktree_path: worktree,
              lifecycle_state: "awaiting_review",
              integration_status: null,
              conflict_state: null,
            },
          ]),
        );
        const manifest = await api(
          `/api/tools/effective?project_id=${project.id}&task_id=${id}`,
        );
        assert(
          manifest.skills.some((skill) => skill.name === "worktree-only"),
          JSON.stringify(manifest.skills),
        );
        assert(
          manifest.rules.some(
            (rule) => rule.path.includes(id) && rule.path.endsWith("AGENTS.md"),
          ),
        );
        assert(!manifest.skills.some((skill) => skill.source_root === root));
        return {
          id,
          workspace: manifest.workspace,
          skills: manifest.skills.map((skill) => skill.name),
        };
      } finally {
        await writeFile(registry, previous);
      }
    },
  );
  await check(
    "daemon restart interrupts and explicitly resumes same checkpoint",
    async () => {
      const id = await task(
        "restart",
        [{ text: "Fin après reprise.", delay: 30000 }],
        "studio_reviewer",
      );
      let recovery;
      for (let i = 0; i < 60; i++) {
        recovery = await api(`/api/tasks/${id}/recovery`);
        if (recovery.checkpoint) break;
        await pause(100);
      }
      assert(recovery.checkpoint);
      daemon.kill();
      await new Promise((r) => daemon.once("exit", r));
      start();
      await ready();
      const interrupted = await api("/api/tasks/" + id);
      assert.equal(interrupted.status, "interrupted");
      scripts.set("restart", [{ text: "Reprise validée." }]);
      await api(`/api/tasks/${id}/resume`, "POST", {});
      const row = await finished(id);
      assert.equal(row.status, "completed", JSON.stringify(row));
      const after = await api(`/api/tasks/${id}/recovery`);
      assert.equal(after.checkpoint.session_id, recovery.checkpoint.session_id);
      return { id, status: row.status, session: after.checkpoint.session_id };
    },
  );
  await check(
    "restart during tool-round human wait asks again before continuing",
    async () => {
      const sequence = [];
      for (let i = 0; i < 16; i++) {
        await writeFile(join(root, `round-${i}.txt`), String(i));
        sequence.push(tool("read_file", { path: `workspace:/round-${i}.txt` }));
      }
      sequence.push({ text: "Reprise du budget validée." });
      const id = await task("round-wait", sequence);
      const pending = async () => {
        for (let i = 0; i < 160; i++) {
          const response = await fetch(`${base}/api/tasks/${id}/human-input`);
          if (response.ok) return response.json();
          await pause(100);
        }
        throw Error("Round-limit prompt missing");
      };
      await pending();
      const before = await api(`/api/tasks/${id}/recovery`);
      assert.equal(before.checkpoint.waiting.tool_round_limit, true);
      daemon.kill();
      await new Promise((resolve) => daemon.once("exit", resolve));
      start();
      await ready();
      await api(`/api/tasks/${id}/resume`, "POST", {});
      const again = await pending();
      assert(again.choices.includes("Continuer (+10 tours)"));
      await api(`/api/tasks/${id}/human-reply`, "POST", {
        response: "Continuer (+10 tours)",
      });
      const row = await finished(id);
      assert.equal(row.status, "completed", JSON.stringify(row));
      return { id, round: before.checkpoint.round };
    },
  );
  await check(
    "restart during ask_user preserves the consumed round and asks again",
    async () => {
      const question = {
        question: "Confirmer le scénario de validation ?",
        choices: ["Continuer", "Arrêter"],
      };
      const id = await task("question-wait", [
        { text: `TOOL: ask_user\n${JSON.stringify(question)}` },
        { text: "Question traitée." },
      ]);
      const pending = async () => {
        for (let i = 0; i < 120; i++) {
          const r = await fetch(`${base}/api/tasks/${id}/human-input`);
          if (r.ok) return r.json();
          await pause(100);
        }
        throw Error("Question missing");
      };
      await pending();
      const before = await api(`/api/tasks/${id}/recovery`);
      assert.equal(before.checkpoint.round, 1);
      assert.equal(before.checkpoint.max_tool_rounds, 16);
      daemon.kill();
      await new Promise((resolve) => daemon.once("exit", resolve));
      start();
      await ready();
      scripts.set("question-wait", [
        { text: `TOOL: ask_user\n${JSON.stringify(question)}` },
        { text: "Réponse fraîche constatée." },
      ]);
      await api(`/api/tasks/${id}/resume`, "POST", {});
      await pending();
      await api(`/api/tasks/${id}/human-reply`, "POST", {
        response: "Continuer",
      });
      const row = await finished(id);
      assert.equal(row.status, "completed", JSON.stringify(row));
      const after = await api(`/api/tasks/${id}/recovery`);
      assert(after.checkpoint.round >= 2);
      return { id, round: after.checkpoint.round };
    },
  );
  await check(
    "crash after an external effect blocks mutations until inspected",
    async () => {
      const id = await task("unknown-effect", [
        tool("run_command", {
          program: "node",
          args: [
            "-e",
            "require('fs').appendFileSync('effect.md','once\\n');setTimeout(()=>process.exit(0),5000)",
          ],
        }),
        { text: "Effet terminé." },
      ]);
      for (let i = 0; i < 100; i++) {
        if (await readFile(join(root, "effect.md"), "utf8").catch(() => null))
          break;
        await pause(100);
      }
      assert.equal(await readFile(join(root, "effect.md"), "utf8"), "once\n");
      daemon.kill();
      await new Promise((r) => daemon.once("exit", r));
      start();
      await ready();
      const recovery = await api(`/api/tasks/${id}/recovery`);
      assert.equal(recovery.ledger.unknown_count, 1);
      const operation = recovery.ledger.operations.find(
        (op) => op.state === "started",
      );
      const head = git(root, "rev-parse", "HEAD");
      await api(
        `/api/studio/projects/${project.id}/delivery/commit`,
        "POST",
        {
          task_id: id,
          operation_id: randomUUID(),
          request: {
            paths: ["effect.md"],
            expected_versions: {
              "effect.md": createHash("sha256").update("once\n").digest("hex"),
            },
            expected_head: head,
            message: "must stay blocked",
          },
        },
        409,
      );
      assert.equal(git(root, "rev-parse", "HEAD"), head);
      await api(
        `/api/tasks/${id}/recovery/operations/${operation.operation_id}/resolve`,
        "POST",
        {
          decision: "applied",
          note: "Inspection réelle : effect.md contient exactement une ligne once ; aucun replay demandé.",
        },
      );
      scripts.set("unknown-effect", [
        tool("read_file", { path: "workspace:/effect.md" }),
        { text: "Inspection après reprise terminée." },
      ]);
      await api(`/api/tasks/${id}/resume`, "POST", {});
      const row = await finished(id);
      assert.equal(row.status, "completed", JSON.stringify(row));
      assert.equal(await readFile(join(root, "effect.md"), "utf8"), "once\n");
      const after = await api(`/api/tasks/${id}/recovery`);
      assert.equal(after.ledger.unknown_count, 0);
      return {
        id,
        operation: operation.operation_id,
        status: row.status,
        ledger: after.ledger,
      };
    },
  );
  await check(
    "crash after a recorded tool result does not repeat its effect",
    async () => {
      const id = await task("recorded-effect", [
        tool("write_file", fileArgs("recorded.md", "recorded once\n")),
        { text: "Réponse après effet.", delay: 30000 },
      ]);
      let before;
      for (let i = 0; i < 100; i++) {
        before = await api(`/api/tasks/${id}/recovery`);
        if (
          before.ledger.operations.some((op) => op.state === "completed") &&
          before.checkpoint?.round >= 1
        )
          break;
        await pause(100);
      }
      assert.equal(
        before.ledger.operations.filter(
          (op) => op.tool === "write_file" && op.state === "completed",
        ).length,
        1,
      );
      daemon.kill();
      await new Promise((r) => daemon.once("exit", r));
      start();
      await ready();
      scripts.set("recorded-effect", [
        { text: "Résultat conservé, aucune répétition." },
      ]);
      await api(`/api/tasks/${id}/resume`, "POST", {});
      const row = await finished(id);
      assert.equal(row.status, "completed", JSON.stringify(row));
      const after = await api(`/api/tasks/${id}/recovery`);
      assert.equal(
        after.ledger.operations.filter((op) => op.tool === "write_file").length,
        1,
      );
      assert.equal(
        await readFile(join(root, "recorded.md"), "utf8"),
        "recorded once\n",
      );
      return {
        id,
        checkpoint: after.checkpoint,
        operations: after.ledger.operations,
      };
    },
  );
  await check("restart retains the full literal task beyond the truncated task title", async () => {
    let initialDirectMode;
    const id=await task("durable-file-goals",[
      {...tool("write_file",fileArgs("DURABLE-FIRST.md","first\n")),verify:(_text,body)=>{
        initialDirectMode=body.messages.some(m=>m.role==="user" && m.content.includes("[Direct file task — explicit paths]"));
      }},
      {text:"Réponse en attente.",delay:30000},
    ],"studio_scaffold",{message:"Crée DURABLE-FIRST.md. "+"Contexte complémentaire conservé. ".repeat(25)+"Ensuite crée DURABLE-SECOND.md. CASE:durable-file-goals"});
    const before=await waitUntil(async()=>{const r=await api(`/api/tasks/${id}/recovery`);return r.checkpoint?.round>=1&&r;},"recorded first file");
    assert.equal(typeof initialDirectMode,"boolean");
    await restart();
    scripts.set("durable-file-goals",[
      {text:"Tout est terminé."},
      {...tool("write_file",fileArgs("DURABLE-SECOND.md","second\n")),verify:(_text,body)=>{
        assert.equal(body.messages[0].content.includes("direct file execution mode"),initialDirectMode,"The selected context mode must survive daemon restart, including conservative full-plan fallback");
        assert(body.messages.at(-1).content.includes("[Pending physical deliverables]"));
        assert(body.messages.at(-1).content.includes("DURABLE-SECOND.md"));
      }},
      {text:"Les deux fichiers sont présents après reprise."},
    ]);
    await api(`/api/tasks/${id}/resume`,"POST",{});
    const row=await finished(id);assert.equal(row.status,"completed",JSON.stringify(row));
    assert.equal(await readFile(join(root,"DURABLE-FIRST.md"),"utf8"),"first\n");
    assert.equal(await readFile(join(root,"DURABLE-SECOND.md"),"utf8"),"second\n");
    const after=await api(`/api/tasks/${id}/recovery`);
    assert.equal(after.checkpoint.session_id,before.checkpoint.session_id);
    assert.equal(after.ledger.operations.filter(o=>o.tool==="write_file").length,2);
    return {id,session:after.checkpoint.session_id,outcome:row.outcome};
  });
  await check("REC-04 interrupted tool approval requires a fresh request", async () => {
    const policy = (await api("/api/tools/policy")).policy;
    try {
      await api("/api/tools/policy", "POST", {policy: {...policy, require_approval: ["write_file"]}});
      await api("/api/permissions/mode", "POST", {mode: "ask_me"});
      const key = "approval-crash";
      const operation = () => tool("write_file", fileArgs("approval-once.md", "fresh approval\n"));
      const id = await task(key, [operation(), {text: "Écriture approuvée."}]);
      const pending = () => waitUntil(async () => {
        const response = await fetch(`${base}/api/tasks/${id}/human-input`);
        return response.ok && response.json();
      }, "approval question");
      await pending();
      const before = await api(`/api/tasks/${id}/recovery`);
      assert.equal(before.checkpoint.waiting.tool, "write_file");
      const oldQueue = (await api("/api/permissions/queue")).items.find(q => q.task_id === id && q.status === "pending");
      assert(oldQueue);
      await restart();
      assert.equal((await fetch(`${base}/api/tasks/${id}/human-reply`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({response:"Approuver"})})).status, 404);
      scripts.set(key, [operation(), {text: "Écriture approuvée après reprise."}]);
      await api(`/api/tasks/${id}/resume`, "POST", {});
      await pending();
      const queue = (await api("/api/permissions/queue")).items;
      const fresh = queue.find(q => q.task_id === id && q.id !== oldQueue.id && q.status === "pending");
      assert(fresh);
      const stale = await fetch(`${base}/api/permissions/queue/${oldQueue.id}/approve`, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      assert.equal(stale.status, 409, "Historical approval must not unblock the new question");
      assert.equal(await readFile(join(root,"approval-once.md"),"utf8").catch(()=>null),null);
      await api(`/api/permissions/queue/${fresh.id}/approve`, "POST", {});
      assert.equal((await finished(id)).status,"completed");
      assert.equal(await readFile(join(root,"approval-once.md"),"utf8"),"fresh approval\n");
      return {id, oldRequest:oldQueue.id, freshRequest:fresh.id};
    } finally {
      await api("/api/tools/policy", "POST", {policy});
      await api("/api/permissions/mode", "POST", {mode:"allow_all"});
    }
  });
  await check("REC-06 concurrent resume and cancel preserves cancellation", async () => {
    const ids=[];
    for(let i=0;i<5;i++) {
      const key=`cancel-resume-${i}`;
      const id=await task(key,[{text:"attente",delay:30000}]);
      await checkpointed(id);
      await restart();
      scripts.set(key,[{...tool("write_file",fileArgs(`NEVER-CANCEL-${i}.md`,"bad")),delay:1200}]);
      const responses=await Promise.all([
        fetch(`${base}/api/tasks/${id}/resume`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}),
        fetch(`${base}/api/tasks/${id}/cancel`,{method:"POST"}),
      ]);
      assert.equal(responses[1].status,200);
      await inactive(id);
      assert.equal((await api(`/api/tasks/${id}`)).status,"cancelled");
      assert.equal(await readFile(join(root,`NEVER-CANCEL-${i}.md`),"utf8").catch(()=>null),null);
      assert.notEqual((await fetch(`${base}/api/tasks/${id}/resume`,{method:"POST"})).status,200);
      ids.push({id,resumeStatus:responses[0].status});
    }
    return {races:ids};
  });
  await check("REC-07 pause during long command refuses overlapping resume", async () => {
    const id=await task("pause-command",[
      tool("run_command",{program:"node",args:["-e","require('fs').appendFileSync('pause-command.md','once\\n');setTimeout(()=>process.exit(0),6000)"]}),
      {text:"Fin après la commande."},
    ]);
    await waitUntil(async()=>await readFile(join(root,"pause-command.md"),"utf8").catch(()=>null),"long command started");
    await api(`/api/tasks/${id}/pause`,"POST",{});
    assert.equal((await api(`/api/tasks/${id}/recovery`)).execution_active,true);
    const refused=await fetch(`${base}/api/tasks/${id}/resume`,{method:"POST"});
    assert.equal(refused.status,500);
    assert.match(await refused.text(),/active|stopping/);
    await inactive(id);
    assert.equal((await api(`/api/tasks/${id}`)).status,"paused");
    await api(`/api/tasks/${id}/resume`,"POST",{});
    assert.equal((await finished(id)).status,"completed");
    assert.equal(await readFile(join(root,"pause-command.md"),"utf8"),"once\n");
    const after=await api(`/api/tasks/${id}/recovery`);
    assert.equal(after.ledger.operations.filter(o=>o.tool==="run_command").length,1);
    return {id,operations:after.ledger.operations};
  });
  await check("pause and cancel release human waits without reusing their channels", async () => {
    const question={question:"Valider le scénario de reprise ?",choices:["Continuer","Arrêter"]};
    const id=await task("pause-question",[{text:`TOOL: ask_user\n${JSON.stringify(question)}`},{text:"Fin"}]);
    const pending=()=>waitUntil(async()=>{const r=await fetch(`${base}/api/tasks/${id}/human-input`);return r.ok&&r.json();},"human wait");
    await pending();
    await api(`/api/tasks/${id}/pause`,"POST",{});
    await inactive(id);
    assert.equal((await api(`/api/tasks/${id}`)).status,"paused");
    const checkpoint=await api(`/api/tasks/${id}/recovery`);
    assert.equal(checkpoint.checkpoint.waiting.tool,"ask_user");
    assert.equal((await fetch(`${base}/api/tasks/${id}/human-input`)).status,404);
    scripts.set("pause-question",[{text:`TOOL: ask_user\n${JSON.stringify(question)}`},{text:"Nouvelle réponse reçue."}]);
    await api(`/api/tasks/${id}/resume`,"POST",{});
    await pending();
    await api(`/api/tasks/${id}/cancel`,"POST",{});
    await inactive(id);
    assert.equal((await api(`/api/tasks/${id}`)).status,"cancelled");
    assert.equal((await fetch(`${base}/api/tasks/${id}/human-reply`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({response:"Continuer"})})).status,404);
    return {id,checkpoint:checkpoint.checkpoint};
  });
  await check("REC-08 resume uses the current revoked tool policy", async () => {
    const policy=(await api("/api/tools/policy")).policy;
    const id=await task("policy-resume",[{text:"attente",delay:30000}]);
    await checkpointed(id);
    await restart();
    try {
      await api("/api/tools/policy","POST",{policy:{...policy,allowed_write_paths:[]}});
      scripts.set("policy-resume",[tool("write_file",fileArgs("NEVER-POLICY.md","bad")),{text:"Écriture refusée par la politique courante."}]);
      await api(`/api/tasks/${id}/resume`,"POST",{});
      const row=await finished(id);
      assert.equal(await readFile(join(root,"NEVER-POLICY.md"),"utf8").catch(()=>null),null);
      assert(row.outcome.failed_tool_calls>=1,JSON.stringify(row));
      assert.notEqual(row.outcome.result,"succeeded");
      return {id,outcome:row.outcome};
    } finally {await api("/api/tools/policy","POST",{policy});}
  });
  await check("REC-09 interrupted delegation retains children and uncertain effect", async () => {
    daemonEnv.AKASHA_STUDIO_WORKTREE_ENABLED="1";
    await restart();
    let moved;
    try {
      scripts.set("recovery-child",[{text:"Enfant en attente",delay:30000}]);
      const parent=await task("recovery-parent",[{text:"TOOL: delegate_to_agent studio_fullstack CASE:recovery-child Attend la validation."},{text:"parent fini"}],"studio_scaffold",{studio_delegate_single_level:false});
      const child=await waitUntil(async()=>{
        const recovery=await api(`/api/tasks/${parent}/recovery`);
        return recovery.children.find(c=>c.agent==="studio_fullstack");
      },"persisted delegated child");
      const childId=child.task_id;
      const childBefore=await checkpointed(childId);
      assert(childBefore.checkpoint.workspace.includes("studio-worktrees"),JSON.stringify(childBefore));
      await restart();
      const recovery=await api(`/api/tasks/${parent}/recovery`);
      assert(recovery.children.some(c=>c.task_id===childId && c.status==="interrupted"));
      const delegation=recovery.ledger.operations.find(o=>o.tool==="delegate_to_agent" && o.state==="started");
      assert(delegation,JSON.stringify(recovery));
      await api(`/api/tasks/${parent}/recovery/operations/${delegation.operation_id}/resolve`,"POST",{decision:"applied",note:"Enfant persistant inspecté ; reprendre cet enfant sans créer une nouvelle délégation."});
      scripts.set("recovery-parent",[{text:"Délégation existante inspectée."}]);
      await api(`/api/tasks/${parent}/resume`,"POST",{});
      assert.equal((await finished(parent)).status,"completed");
      assert.equal((await api(`/api/tasks/${parent}/recovery`)).children.length,1);
      // REC-05: move the actual child worktree after the physical restart.
      const workspace=childBefore.checkpoint.workspace;
      moved={from:workspace,to:workspace+"-moved"};
      await rename(moved.from,moved.to);
      const rootHead=git(root,"rev-parse","HEAD");
      const refused=await fetch(`${base}/api/tasks/${childId}/resume`,{method:"POST"});
      assert.equal(refused.status,500);
      assert.match(await refused.text(),/worktree|workspace|missing|unavailable|cannot find/i);
      assert.equal((await api(`/api/tasks/${childId}`)).status,"interrupted");
      assert.equal(git(root,"rev-parse","HEAD"),rootHead);
      await rename(moved.to,moved.from);moved=null;
      scripts.set("recovery-child",[{text:"Enfant repris dans son worktree restauré."}]);
      await api(`/api/tasks/${childId}/resume`,"POST",{});
      assert.equal((await finished(childId)).status,"completed");
      const childAfter=await api(`/api/tasks/${childId}/recovery`);
      assert.equal(childAfter.checkpoint.session_id,childBefore.checkpoint.session_id);
      report.cases.push({name:"REC-05 missing worktree refuses resume without root fallback; restored worktree resumes",status:"passed",evidence:{childId,workspace,rootHead}});
      return {parent,childId,delegation:delegation.operation_id};
    } finally {
      if(moved)await rename(moved.to,moved.from);
      delete daemonEnv.AKASHA_STUDIO_WORKTREE_ENABLED;
      await restart();
    }
  });
  // Real browser -> Vite proxy -> daemon. No page.route() or API mocking.
  await check("real UI desktop/mobile consumes daemon APIs", async () => {
    const uiProbe=createServer();
    await new Promise(resolve=>uiProbe.listen(0,"127.0.0.1",resolve));
    const uiPort=uiProbe.address().port;
    await new Promise(resolve=>uiProbe.close(resolve));
    const uiUrl=`http://127.0.0.1:${uiPort}`;
    ui = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        String(uiPort),
        "--strictPort",
      ],
      {
        cwd: resolve("."),
        env: { ...process.env, VITE_DAEMON_URL: base },
        windowsHide: true,
        stdio: ["ignore", log, log],
      },
    );
    report.uiServer={url:uiUrl,pid:ui.pid,daemon:base};
    let uiReady=false;
    for (let i = 0; i < 60; i++) {
      assert.equal(ui.exitCode,null,"The isolated Vite process exited during startup");
      try {
        const response=await fetch(uiUrl+"/api/studio/projects");
        if (response.ok && (await response.text()).includes(project.id)) {uiReady=true;break;}
      } catch {}
      await pause(200);
    }
    assert(uiReady,"The UI proxy must reach this campaign's isolated project");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", async (response) => {
      if (response.url().includes("/lsp/")) {
        (report.uiLsp ??= []).push({
          url: response.url(),
          status: response.status(),
          body: await response.json().catch(() => null),
        });
      }
    });
    await page.goto(uiUrl);
    await page.getByRole("button", { name: "Choisir un projet" }).waitFor();
    await page.getByRole("button", { name: "Choisir un projet" }).click();
    await page.getByTestId(`studio-project-${project.id}`).click();
    await page
      .getByRole("button", { name: "Fichiers", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "sample.ts", exact: true }).click();
    await page.locator(".monaco-editor").waitFor();
    await page.getByText("Analyse sémantique LSP", { exact: true }).click();
    const lspToggle = page.getByRole("checkbox", {
      name: "Activer le serveur pour ce projet",
    });
    await lspToggle.check();
    for (let i = 0; i < 3; i++) {
      try {
        await page
          .locator(".editor-semantic-tools")
          .getByText(/\d+ diagnostic\(s\) serveur/)
          .waitFor({ timeout: 4000 });
        break;
      } catch (error) {
        if (i === 2) throw error;
        await lspToggle.uncheck();
        await pause(500);
        await lspToggle.check();
      }
    }
    await page.locator(".monaco-editor").click();
    await page.keyboard.press("Control+Home");
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
    await page.getByLabel("Nouveau nom", { exact: true }).fill("renamedInUi");
    await page
      .getByRole("button", { name: "Préparer le renommage", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Appliquer ce plan", exact: true })
      .waitFor();
    await page.screenshot({
      path: join(data, "editor-lsp.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Appliquer ce plan", exact: true })
      .click();
    await page.getByText(/Renommage appliqué/).waitFor();
    assert.match(
      await readFile(join(root, "sample.ts"), "utf8"),
      /renamedInUi/,
    );
    await page
      .getByRole("button", { name: "Discussion", exact: true })
      .first()
      .click();
    await page.locator(".send-context > summary").click();
    await page
      .locator(".agent-capabilities")
      .getByText("studio_project_manager", { exact: true })
      .waitFor();
    await page.locator(".send-context > summary").click();
    scripts.set("ui", [
      tool("browser", { argv: ["navigate", fixture + "/demo"] }),
      tool("browser", { argv: ["screenshot"] }),
      { text: "Observation UI terminée." },
    ]);
    await page
      .locator(".chat-form textarea")
      .fill("CASE:ui Observe la page de validation et joins une capture.");
    const sentResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/message") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Envoyer", exact: true }).click();
    const sent = await (await sentResponse).json();
    await finished(sent.task_id);
    await page
      .locator(".bubble.assistant")
      .getByRole("button", { name: /Détails de la tâche/i })
      .last()
      .click();
    const modal = page.getByRole("dialog", { name: /Détail de la tâche/i });
    await modal.getByRole("tab", { name: "Résumé", exact: true }).click();
    await modal.locator(".task-outcome").waitFor();
    await modal
      .getByText("Outils, règles et skills de cette tâche", { exact: true })
      .click();
    await modal
      .locator(".agent-capabilities")
      .getByText("studio_project_manager", { exact: true })
      .waitFor();
    await modal.getByText("Preuves de la tâche", { exact: true }).click();
    await modal
      .getByRole("button", { name: /browser_screenshot/ })
      .first()
      .click();
    await modal.getByRole("img", { name: /Capture enregistrée/ }).waitFor();
    await modal
      .getByText("Reprise et opérations interrompues", { exact: true })
      .click();
    await modal.getByText(/0 opération\(s\) au résultat inconnu/).waitFor();
    await page.screenshot({
      path: join(data, "task-evidence.png"),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    assert(
      !/data:image\/png;base64|iVBORw0KGgo/.test(
        await page.locator(".chat-log").innerText(),
      ),
      "Binary PNG must stay in the evidence viewer, not in chat prose",
    );
    await page.screenshot({ path: join(data, "desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page
      .getByRole("button", { name: "Discussion", exact: true })
      .last()
      .click();
    await page.locator(".chat-form textarea").waitFor();
    await page.screenshot({ path: join(data, "mobile.png"), fullPage: true });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    return { screenshots: ["desktop.png", "mobile.png"], pageErrors: errors };
  });
  await check("delivery reads reject foreign and opaque browser origins", async () => {
    for (const path of [`/api/studio/projects/${project.id}/delivery/status`, `/api/studio/projects/${project.id}/delivery/pr`, `/api/tasks/${randomUUID()}/delivery?ignored=1`]) {
      for (const origin of ["https://evil.example", "null"]) {
        const response=await fetch(base+path,{headers:{Origin:origin}});
        assert.equal(response.status,403,`${origin} ${path}`);
      }
    }
    return {denied:6};
  });
  await check("delivery refuses repository configured process helpers before GitHub access", async () => {
    const root=join(data,"studio-projects",project.id);
    const config=join(root,".git","config");const original=await readFile(config,"utf8");
    try {
      for (const addition of ['\n[filter "studio-test"]\n clean = studio-never-execute-this\n','\n[http]\n sslVerify = false\n proxy = http://127.0.0.1:9\n extraHeader = Authorization: unsafe-test-header\n','\n[malformed']) {
        await writeFile(config,original+addition);
        const result=await api(`/api/studio/projects/${project.id}/delivery/status`);
        assert.equal(result.success,false,JSON.stringify(result));
        assert.match(JSON.stringify(result),/configuration.*(?:unsupported|refused)/);
      }
      return {refused:true,configurations:3};
    } finally {await writeFile(config,original);}
  });
  if (process.env.CODE_STUDIO_TEST_PUBLISH === "1") {
    await check(
      "explicit GitHub push draft PR and CI state through delivery API",
      async () => {
        const previous = project;
        try {
          project = await api(
            "/api/studio/projects",
            "POST",
            { name: "Publication validation", tech_stack: "texte" },
            201,
          );
          const id = await task("publish", [
            { text: "Préparation de publication terminée." },
          ]);
          await finished(id);
          const publishRoot = join(data, "studio-projects", project.id);
          const branch =
            "validation/studio-agentic-" + randomUUID().slice(0, 8);
          git(
            publishRoot,
            "remote",
            "add",
            "origin",
            "https://github.com/azerothl/Akasha-code-studio.git",
          );
          git(publishRoot, "fetch", "--depth=1", "origin", "main");
          git(publishRoot, "checkout", "-B", branch, "FETCH_HEAD");
          git(publishRoot, "config", "user.name", "Studio validation");
          git(
            publishRoot,
            "config",
            "user.email",
            "studio-validation@example.invalid",
          );
          const name = "STUDIO_VALIDATION_" + randomUUID().slice(0, 8) + ".md";
          const content =
            "Temporary real GitHub delivery API validation. This draft must be closed without merging.\n";
          await writeFile(join(publishRoot, name), content);
          const path = `/api/studio/projects/${project.id}/delivery`;
          const mutate = (action, request) =>
            api(path + "/" + action, "POST", {
              task_id: id,
              operation_id: randomUUID(),
              expected_repository: "azerothl/Akasha-code-studio",
              request,
            });
          const committed = await mutate("commit", {
            paths: [name],
            expected_versions: {
              [name]: createHash("sha256").update(content).digest("hex"),
            },
            expected_head: git(publishRoot, "rev-parse", "HEAD"),
            message: "test: temporary delivery API validation",
          });
          assert.equal(
            committed.result.success,
            true,
            JSON.stringify(committed),
          );
          const head = git(publishRoot, "rev-parse", "HEAD");
          const pushRequest={remote:"origin",branch,expected_head:head,expected_remote_head:"missing"};
          await api(path+"/push","POST",{task_id:id,operation_id:randomUUID(),expected_repository:"example/wrong-destination",request:pushRequest},409);
          await api(path+"/push","POST",{task_id:id,operation_id:randomUUID(),request:pushRequest},400);
          const pushed = await mutate("push", {
            remote: "origin",
            branch,
            expected_head: head,
            expected_remote_head: "missing",
          });
          assert.equal(pushed.result.success, true, JSON.stringify(pushed));
          report.publishedBranch = branch;
          const created = await mutate("pr", {
            remote: "origin",
            head: branch,
            base: "main",
            expected_head: head,
            title: "test: temporary Code Studio delivery API validation",
            body: "Temporary integration test of the Code Studio commit/push/PR/CI API. This draft will be closed without merging after evidence collection.",
            draft: true,
          });
          report.testPullRequest = created.result.pr;
          await writeFile(
            join(data, "report.json"),
            JSON.stringify(report, null, 2),
          );
          assert.equal(created.result.success, true, JSON.stringify(created));
          const status = await api(
            `${path}/pr?remote=origin&number=${created.result.pr.number}&task_id=${id}`,
          );
          assert.equal(status.success, true, JSON.stringify(status));
          assert.equal(status.pr.headRefOid, head);
          assert.equal(status.checks_match_local_head, true);
          assert.equal(status.checks_state, "not_run");
          return { id, head, branch, created, status };
        } finally {
          project = previous;
        }
      },
    );
  }
  report.nativeRequests = requests.filter((r) => r.native).length;
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.error = e.stack;
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) {
      await writeFile(
        join(data, "ui-failure.txt"),
        await page
          .locator("body")
          .innerText()
          .catch(() => ""),
      );
      await page
        .screenshot({ path: join(data, "ui-failure.png"), fullPage: true })
        .catch(() => {});
    }
  }
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const child of [ui,daemon]) {
    if (child && child.exitCode===null && child.signalCode===null) {
      const stopped=new Promise(resolve=>child.once("exit",resolve));
      child.kill();
      await Promise.race([stopped,pause(3000)]);
    }
  }
  server.closeAllConnections();
  server.close();
  report.requests = requests;
  await writeFile(join(data, "report.json"), JSON.stringify(report, null, 2));
  console.log("EVIDENCE", join(data, "report.json"));
}
