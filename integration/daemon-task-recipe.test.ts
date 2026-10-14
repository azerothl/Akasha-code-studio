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

async function deleteProject(id: string) {
  await fetch(`${DAEMON_URL}/api/studio/projects/${id}?force=1`, { method: "DELETE" }).catch(() => undefined);
}

describe("Code Studio — recette tâche réelle", () => {
  afterEach(async () => {
    const pending = createdIds.splice(0);
    await Promise.all(pending.map((id) => deleteProject(id)));
  });

  it.skipIf(!ENABLED)(
    "envoie une tâche, suit son statut et vérifie RECIPE_OK.txt",
    async () => {
      const status = await fetch(`${DAEMON_URL}/api/status`).catch(() => null);
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
            "Crée uniquement le fichier RECIPE_OK.txt à la racine du projet. Son contenu doit être exactement la ligne recipe-ok. Utilise write_file ou write_code, puis arrête-toi.",
        }),
      });
      expect(messageRes.ok, await messageRes.text()).toBe(true);
      const sent = (await messageRes.json()) as { task_id?: string };
      expect(sent.task_id).toBeTruthy();

      const deadline = Date.now() + 150_000;
      let task: TaskPayload = {};
      while (Date.now() < deadline) {
        const taskRes = await fetch(`${DAEMON_URL}/api/tasks/${sent.task_id}`);
        expect(taskRes.ok).toBe(true);
        task = (await taskRes.json()) as TaskPayload;
        if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const diffRes = await fetch(`${DAEMON_URL}/api/tasks/${sent.task_id}/studio-diff`);
      const diffBody = await diffRes.text();
      const progress = (task.progress ?? []).map((row) => row.message ?? "").slice(-8).join("\n");
      expect(
        task.status,
        `statut=${task.status ?? "timeout"} failure=${task.failure_detail ?? ""} diff=${diffRes.status} ${diffBody.slice(0, 500)}\n${progress}`,
      ).toBe("completed");

      const rawRes = await fetch(
        `${DAEMON_URL}/api/studio/projects/${created.id}/raw?path=${encodeURIComponent("RECIPE_OK.txt")}`,
      );
      expect(rawRes.ok, await rawRes.text()).toBe(true);
      const raw = (await rawRes.json()) as { content?: string };
      expect(raw.content ?? "").toContain("recipe-ok");
      expect(diffRes.status === 200 || diffRes.status === 404).toBe(true);
    },
    180_000,
  );
});
