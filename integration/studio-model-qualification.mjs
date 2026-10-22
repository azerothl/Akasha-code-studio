/** Explicit real-provider admission recipe. No project files or tools are touched. */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const base = (process.env.CODE_STUDIO_DAEMON_URL ?? "http://127.0.0.1:3876").replace(/\/$/, "");
const models = JSON.parse(process.env.CODE_STUDIO_QUALIFY_MODELS ?? "[]");
assert(Array.isArray(models) && models.length > 0, "Set CODE_STUDIO_QUALIFY_MODELS to a JSON array of configured {provider,model} routes");
const folder = await mkdtemp(join(tmpdir(), "studio-model-qualification-"));
const report = { at: new Date().toISOString(), kind: "real configured providers, inert tool qualification only", cases: [] };
for (const route of models) {
  assert(typeof route.provider === "string" && typeof route.model === "string");
  try {
    const response = await fetch(`${base}/api/router/studio-qualify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(route), signal: AbortSignal.timeout(25000) });
    const value = await response.json();
    report.cases.push({ ...route, ...value, passed: response.ok && value.qualification?.status === "qualified" && !value.error });
  } catch (error) { report.cases.push({ ...route, passed: false, error: String(error) }); }
}
await writeFile(join(folder, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: join(folder, "report.json"), cases: report.cases }, null, 2));
if (report.cases.some(result => !result.passed)) process.exitCode = 1;
