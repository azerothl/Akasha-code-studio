/**
 * Tests d’intégration HTTP → daemon Akasha (Code Studio).
 *
 * Prérequis : daemon démarré et joignable (défaut `http://127.0.0.1:3876`).
 * URL : `CODE_STUDIO_DAEMON_URL` ou `VITE_DAEMON_URL`.
 *
 * Exemple (dépôt Akasha) : `.\target\debug\akasha.exe start --foreground`
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DAEMON_URL = (
  process.env.CODE_STUDIO_DAEMON_URL ??
  process.env.VITE_DAEMON_URL ??
  "http://127.0.0.1:3876"
).replace(/\/$/, "");

async function fetchDaemonStatus(): Promise<boolean> {
  try {
    const r = await fetch(`${DAEMON_URL}/api/status`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

describe("Code Studio — API daemon (intégration)", () => {
  let createdId: string | null = null;

  beforeAll(async () => {
    const ok = await fetchDaemonStatus();
    if (!ok) {
      throw new Error(
        [
          `Daemon injoignable à ${DAEMON_URL} (GET /api/status).`,
          "Démarrez le daemon Akasha (port 3876 par défaut), puis relancez : npm run test:daemon",
          "Exemple : depuis le dépôt Akasha, « akasha start --foreground » ou « cargo run -p akasha-daemon … ».",
        ].join(" "),
      );
    }
  });

  afterAll(async () => {
    if (!createdId) return;
    try {
      await fetch(`${DAEMON_URL}/api/studio/projects/${createdId}?force=1`, { method: "DELETE" });
    } catch {
      /* nettoyage best-effort */
    }
  });

  it("POST /api/studio/projects crée plan, DESIGN, méta, git sur main/master et arbre propre (commit initial)", async () => {
    const stamp = Date.now();
    const payload = {
      name: `Vitest intégration ${stamp}`,
      tech_stack: "React + TypeScript",
      project_summary: "Application de test d’intégration daemon Code Studio.",
    };

    const post = await fetch(`${DAEMON_URL}/api/studio/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(post.status).toBe(201);
    const created = (await post.json()) as { id: string; path: string };
    createdId = created.id;

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(created.path.length).toBeGreaterThan(0);

    const filesRes = await fetch(`${DAEMON_URL}/api/studio/projects/${created.id}/files`);
    expect(filesRes.ok).toBe(true);
    const filesJson = (await filesRes.json()) as { files: string[] };
    expect(filesJson.files).toContain("CODE_STUDIO_PLAN.md");
    expect(filesJson.files).toContain("DESIGN.md");

    const planPath = encodeURIComponent("CODE_STUDIO_PLAN.md");
    const planRes = await fetch(`${DAEMON_URL}/api/studio/projects/${created.id}/raw?path=${planPath}`);
    expect(planRes.ok).toBe(true);
    const planJson = (await planRes.json()) as { content?: string };
    expect(planJson.content).toBeDefined();
    expect(planJson.content).toContain(payload.name);
    expect(planJson.content).toContain("Application de test");

    const designPath = encodeURIComponent("DESIGN.md");
    const designRes = await fetch(`${DAEMON_URL}/api/studio/projects/${created.id}/raw?path=${designPath}`);
    expect(designRes.ok).toBe(true);
    const designJson = (await designRes.json()) as { content?: string };
    expect(designJson.content).toContain("---");
    expect(designJson.content).toMatch(/colors:/i);
    expect(designJson.content).toMatch(/typography:/i);

    const metaRes = await fetch(`${DAEMON_URL}/api/studio/projects/${created.id}`);
    expect(metaRes.ok).toBe(true);
    const meta = (await metaRes.json()) as {
      name: string;
      tech_stack?: string | null;
      project_summary?: string | null;
      git_branch?: string | null;
      git_worktree_clean?: boolean | null;
    };
    expect(meta.name).toBe(payload.name);
    expect(meta.tech_stack).toBe(payload.tech_stack);
    expect(meta.project_summary).toBe(payload.project_summary);
    expect(meta.git_branch).toMatch(/^main$|^master$/);
    /** Sans commit initial, les fichiers seraient non suivis → porcelain non vide. */
    expect(meta.git_worktree_clean).toBe(true);

    const checkRes = await fetch(`${DAEMON_URL}/api/studio/projects/${created.id}/delete-check`);
    expect(checkRes.ok).toBe(true);
    const check = (await checkRes.json()) as {
      worktree_dirty: boolean;
      requires_force: boolean;
      has_git: boolean;
    };
    expect(check.has_git).toBe(true);
    expect(check.worktree_dirty).toBe(false);
    expect(check.requires_force).toBe(false);
  });
});
