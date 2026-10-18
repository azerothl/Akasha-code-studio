/**
 * Recette opt-in : tâche Code Studio réelle jusqu’à un fichier vérifiable.
 *
 * Prérequis :
 * - daemon joignable (`CODE_STUDIO_DAEMON_URL` ou `http://127.0.0.1:3876`)
 * - un modèle configuré dans le routeur du daemon
 * - `npm run test:daemon:task` (active `CODE_STUDIO_E2E_TASK`)
 *
 * Cette recette n’est pas un test Playwright mocké. `npm run test:daemon` sans la variable ignore ce cas.
 * Les échecs conservent le statut, `failure_detail` et les dernières progressions.
 */
import { afterEach, describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const ENABLED = process.env.CODE_STUDIO_E2E_TASK === "1";
const DAEMON_URL = (
  process.env.CODE_STUDIO_DAEMON_URL ??
  process.env.VITE_DAEMON_URL ??
  "http://127.0.0.1:3876"
).replace(/\/$/, "");

type TaskPayload = {
  status?: string;
  failure_detail?: string | null;
  progress?: { message?: string }[];
};

const createdIds: string[] = [];
const taskIds: string[] = [];

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  expect(response.ok, `HTTP ${response.status}: ${text}`).toBe(true);
  return JSON.parse(text) as T;
}

async function deleteProject(id: string) {
  const response = await fetch(`${DAEMON_URL}/api/studio/projects/${id}?force=1`, { method: "DELETE", signal: AbortSignal.timeout(10000) });
  expect(response.ok || response.status === 404, `Nettoyage projet ${id}: HTTP ${response.status}`).toBe(true);
}

describe("Code Studio — recette tâche réelle", () => {
  afterEach(async () => {
    await Promise.all(taskIds.splice(0).map((id) => fetch(`${DAEMON_URL}/api/tasks/${id}/cancel`, { method: "POST", signal: AbortSignal.timeout(5000) }).catch(() => undefined)));
    const pending = createdIds.splice(0);
    await Promise.all(pending.map((id) => deleteProject(id)));
    if (pending.length) {
      const previous = await readFile("test-results/daemon-task-report.json", "utf8").catch(() => null);
      if (previous) await writeFile("test-results/daemon-task-report.json", JSON.stringify({ ...JSON.parse(previous), cleanedProjects: pending }, null, 2), "utf8");
    }
  });

  it.skipIf(!ENABLED)(
    "envoie une tâche, suit son statut et vérifie RECIPE_OK.md et son diff",
    async () => {
      const status = await fetch(`${DAEMON_URL}/api/status`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
      expect(status?.ok, `Daemon injoignable à ${DAEMON_URL}`).toBe(true);

      const createdRes = await fetch(`${DAEMON_URL}/api/studio/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Recette tâche ${Date.now()}`,
          tech_stack: "fichier texte",
          project_summary: "Recette opt-in Code Studio.",
        }),
      });
      expect(createdRes.status).toBe(201);
      const created = (await createdRes.json()) as { id: string };
      createdIds.push(created.id);

      const messageRes = await fetch(`${DAEMON_URL}/api/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: `code-studio-recipe-${created.id}`,
          studio_project_id: created.id,
          studio_assigned_agent: "studio_scaffold",
          message:
            "Crée uniquement le fichier RECIPE_OK.md à la racine du projet. Son contenu doit être exactement la ligne recipe-ok. Utilise write_file ou write_code, puis arrête-toi.",
        }),
      });
      const sent = await readJson<{ task_id?: string }>(messageRes);
      expect(sent.task_id).toBeTruthy();
      taskIds.push(sent.task_id!);

      const deadline = Date.now() + 150_000;
      let task: TaskPayload = {};
      while (Date.now() < deadline) {
        const taskRes = await fetch(`${DAEMON_URL}/api/tasks/${sent.task_id}`, { signal: AbortSignal.timeout(10000) });
        expect(taskRes.ok).toBe(true);
        task = (await taskRes.json()) as TaskPayload;
        if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const diffRes = await fetch(`${DAEMON_URL}/api/tasks/${sent.task_id}/studio-diff`);
      const diffBody = await diffRes.text();
      await mkdir("test-results", { recursive: true });
      await writeFile("test-results/daemon-task-report.json", JSON.stringify({
        at: new Date().toISOString(), daemonUrl: DAEMON_URL, projectId: created.id, taskId: sent.task_id,
        status: task.status, failureDetail: task.failure_detail, progress: task.progress, diffStatus: diffRes.status, diff: diffBody,
      }, null, 2), "utf8");
      const progress = (task.progress ?? []).map((row) => row.message ?? "").slice(-8).join("\n");
      expect(
        task.status,
        `statut=${task.status ?? "timeout"} failure=${task.failure_detail ?? ""} diff=${diffRes.status} ${diffBody.slice(0, 500)}\n${progress}`,
      ).toBe("completed");

      const rawRes = await fetch(
        `${DAEMON_URL}/api/studio/projects/${created.id}/raw?path=${encodeURIComponent("RECIPE_OK.md")}`,
      );
      const raw = await readJson<{ content?: string }>(rawRes);
      expect((raw.content ?? "").replace(/\r\n/g, "\n")).toMatch(/^recipe-ok\n?$/);
      expect(diffRes.status, diffBody).toBe(200);
      const diff = JSON.parse(diffBody) as { files?: { path: string }[] };
      expect(diff.files?.some((file) => file.path === "RECIPE_OK.md"), diffBody).toBe(true);
      await writeFile("test-results/daemon-task-report.json", JSON.stringify({
        at: new Date().toISOString(), daemonUrl: DAEMON_URL, projectId: created.id, taskId: sent.task_id,
        status: task.status, failureDetail: task.failure_detail, progress: task.progress, diffStatus: diffRes.status,
        diff: JSON.parse(diffBody), verifiedFile: { path: "RECIPE_OK.md", content: raw.content },
      }, null, 2), "utf8");
    },
    180_000,
  );
});
