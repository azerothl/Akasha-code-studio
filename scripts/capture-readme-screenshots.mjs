/**
 * Captures the Code Studio screens used by README.md.
 * Requires `npm run dev` on http://127.0.0.1:5178.
 *
 *   node scripts/capture-readme-screenshots.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseURL = process.env.CODE_STUDIO_URL ?? "http://127.0.0.1:5178";
const outDir = path.resolve("docs/screenshots");
const projectId = "00000000-0000-4000-8000-000000000001";
const taskId = "c4e8a1b2-7d3f-4a91-9c20-6b5e0d1a2f30";
const forkTaskId = "9f21d0aa-44e2-4b77-8a11-0c6d5e4b3a21";

const sources = {
  "src/App.tsx": `export function StatusBadge({ label }: { label: string }) {\n  return <span className="status-badge">{label}</span>;\n}\n`,
  "src/api.ts": `export async function fetchStatus() {\n  const response = await fetch("/api/status");\n  return response.json();\n}\n`,
  "index.html": `<!DOCTYPE html>\n<html lang="fr">\n  <head><meta charset="utf-8" /></head>\n  <body>\n    <main>\n      <h1>Atelier</h1>\n      <p>Le badge de statut est visible dès l’ouverture.</p>\n    </main>\n  </body>\n</html>\n`,
  "DESIGN.md": `---\nname: Atelier\ncolors:\n  primary: "#7c6af7"\n  on-primary: "#ffffff"\n  secondary: "#1f6feb"\n  surface: "#0f1419"\n  on-surface: "#e7ecf3"\ntypography:\n  body:\n    fontFamily: "Source Sans 3"\n    fontSize: "16px"\n---\n\n## Overview\n\nInterface sombre, badge de statut en évidence, actions de livraison regroupées.\n`,
  "CODE_STUDIO_PLAN.md": `# Plan Atelier\n\n## Objectif\n\nAfficher l’état du daemon et le cycle de livraison sans quitter le projet.\n\n## Étapes\n\n1. Badge dans l’en-tête\n2. Revue du diff avant application\n3. Fusion seulement après vérification\n`,
};

const tickets = [
  ticket("t-todo", "Préparer le badge de statut", "todo", "studio_frontend"),
  ticket("t-progress", "Brancher le badge sur /api/status", "in_progress", "studio_fullstack", taskId),
  ticket("t-review", "Relire le contraste du badge", "review", "studio_frontend"),
  ticket("t-done", "Documenter le cycle de livraison", "done", "studio_planner"),
];

function ticket(id, title, status, agent, relatedTaskId = null) {
  return {
    id,
    project_id: projectId,
    title,
    description: title,
    status,
    requested_by: "atelier",
    assigned_agent: agent,
    review_agent: "studio_reviewer",
    related_task_id: relatedTaskId,
    acceptance_criteria: [{ id: "visible", text: "Le badge est lisible dans l’en-tête", kind: "manual" }],
    evidence: {},
    created_at: "2026-10-14T09:00:00Z",
    updated_at: "2026-10-14T10:30:00Z",
  };
}

const taskPayload = {
  task_id: taskId,
  status: "completed",
  progress: [
    { message: "verify: npm run test", progress_pct: 80 },
    { message: "command_ok exit 0", progress_pct: 100 },
  ],
  acceptance_review: { missing: ["Contraste vérifié à la main"] },
};

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installApi(page) {
  const unknown = new Set();
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/\/$/, "");
    const method = request.method();

    if (pathname === "/api/events") {
      await route.fulfill({ status: 404, body: "" });
      return;
    }
    if (pathname === "/api/status") {
      await json(route, { status: "ok", version: "0.11.0" });
      return;
    }
    if (pathname === "/api/trust-access") {
      await json(route, { channel_permissions_mode: "workspace" });
      return;
    }
    if (pathname === "/api/studio/projects" && method === "GET") {
      await json(route, {
        projects: [{ id: projectId, name: "Atelier", path: `/studio/${projectId}` }],
      });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}` && method === "GET") {
      await json(route, {
        id: projectId,
        name: "Atelier",
        created_at: "2026-10-01T08:00:00Z",
        tech_stack: "React + TypeScript + Vite",
        project_summary: "Petite interface pour suivre l’état du daemon.",
        policy_notes: "Ne pas élargir le périmètre au-delà du badge et de sa revue.",
        git_branch: "studio/badge-statut",
        git_worktree_clean: false,
        git_worktree_lines: [
          { status: "M", path: "src/App.tsx" },
          { status: "A", path: "src/statusBadge.tsx" },
        ],
        evolutions: [
          {
            id: "evo-badge",
            branch: "studio/badge-statut",
            status: "active",
            created_at: "2026-10-14T09:00:00Z",
          },
        ],
        ticket_enforcement_mode: "soft",
      });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/files`) {
      await json(route, { files: Object.keys(sources) });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/raw`) {
      const filePath = url.searchParams.get("path") ?? "";
      await json(route, {
        path: filePath,
        mime: filePath.endsWith(".md") ? "text/markdown" : "text/plain",
        content: sources[filePath] ?? "",
      });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/code-rag/status`) {
      await json(route, {
        status: "ready",
        files_indexed: 5,
        chunks_indexed: 18,
        built_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        stale: false,
      });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/tickets` && method === "GET") {
      await json(route, { items: tickets });
      return;
    }
    if (pathname.startsWith(`/api/studio/projects/${projectId}/tickets/`)) {
      const id = pathname.split("/").pop();
      const found = tickets.find((item) => item.id === id) ?? tickets[0];
      await json(route, { ticket: found, timeline: [] });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/evolutions`) {
      await json(route, {
        evolutions: [
          {
            id: "evo-badge",
            branch: "studio/badge-statut",
            status: "active",
            created_at: "2026-10-14T09:00:00Z",
          },
        ],
      });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/git/branches`) {
      await json(route, {
        current_branch: "studio/badge-statut",
        branches: [
          {
            name: "main",
            current: false,
            upstream: "origin/main",
            ahead: 0,
            behind: 0,
            last_commit_subject: "État initial du projet",
          },
          {
            name: "studio/badge-statut",
            current: true,
            upstream: null,
            ahead: 2,
            behind: 0,
            last_commit_subject: "Ajoute le badge de statut",
          },
        ],
      });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/git/conflicts`) {
      await json(route, { merge_in_progress: false, conflict_files: [] });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/worktrees`) {
      await json(route, {
        isolation_unit: "child_task",
        explicit_integrate: true,
        worktrees: [
          {
            task_id: taskId,
            root_task_id: taskId,
            project_id: projectId,
            project_root: `/studio/${projectId}`,
            base_branch: "studio/badge-statut",
            base_sha: "a1b2c3d4e5f67890",
            worktree_branch: `wt/${taskId.slice(0, 8)}/${forkTaskId.slice(0, 8)}`,
            worktree_path: `/studio/${projectId}/.worktrees/${forkTaskId.slice(0, 8)}`,
            lifecycle_state: "awaiting_review",
            integration_status: "pending",
            conflict_state: null,
          },
        ],
      });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/preview/logs`) {
      await json(route, { running: false, log: "", preview_inactive: true });
      return;
    }
    if (pathname === `/api/studio/projects/${projectId}/design/validate`) {
      await json(route, { ok: true, diagnostics: [] });
      return;
    }
    if (pathname === `/api/tasks/${taskId}` || pathname === `/api/tasks/${forkTaskId}`) {
      await json(route, pathname.endsWith(forkTaskId) ? { ...taskPayload, task_id: forkTaskId } : taskPayload);
      return;
    }
    if (pathname === `/api/tasks/${taskId}/events` || pathname === `/api/tasks/${forkTaskId}/events`) {
      await json(route, { events: [] });
      return;
    }
    if (pathname === "/api/schedules") {
      await json(route, {
        schedules: [{ id: "nightly", name: "Revue nocturne", enabled: true }],
      });
      return;
    }
    if (pathname === "/api/task_runs") {
      await json(route, {
        task_runs: [
          {
            id: "run-1",
            task_name: "Revue nocturne",
            status: "completed",
            started_at: "2026-10-14T22:00:00Z",
            ended_at: "2026-10-14T22:04:00Z",
            summary: "Aucun écart",
          },
        ],
      });
      return;
    }
    if (pathname === "/api/process/watch/recent") {
      await json(route, {
        events: [{ at: "2026-10-14T22:01:00Z", command: "npm run test", exit_code: 0 }],
      });
      return;
    }
    if (pathname === "/api/terminal/capabilities") {
      await json(route, { current: "powershell", interactive_pty: false, pty_api: [], shells: ["powershell"] });
      return;
    }
    if (pathname === "/api/tools/effective") {
      await json(route, {
        profile: "studio",
        tools: [
          { name: "write_file", policy: "allow" },
          { name: "run_command", policy: "approval" },
          { name: "delete_file", policy: "deny" },
        ],
      });
      return;
    }
    if (pathname === "/api/memory/recall-metrics") {
      await json(route, { hits: 4, empty: 1 });
      return;
    }
    if (pathname === "/api/mcp/status") {
      await json(route, { config_present: true, server_count: 1, runtime: "stdio" });
      return;
    }
    if (pathname === "/api/mcp/runtime") {
      await json(route, { oauth: { mode: "off" } });
      return;
    }
    if (pathname === "/api/lifecycle/hooks") {
      await json(route, { present: true, timeout_sec: 30, sandbox: "workspace", executed_phases: ["on_task_end"] });
      return;
    }
    if (pathname === "/api/permissions/queue") {
      await json(route, {
        requests: [{ id: "perm-1", tool_id: "run_command", status: "pending" }],
      });
      return;
    }
    if (pathname === "/api/automation/webhook/recent") {
      await json(route, {
        count: 1,
        deliveries: [{ idempotency_key: "wh-1", seen_at_unix: 1760430000, status: "accepted" }],
      });
      return;
    }
    if (pathname === "/api/pending-human-input") {
      await json(route, { pending: [] });
      return;
    }
    if (pathname.includes("/human-input")) {
      await route.fulfill({ status: 404, body: "" });
      return;
    }

    unknown.add(`${method} ${pathname}`);
    if (method === "GET") {
      await json(route, {});
      return;
    }
    await json(route, { ok: true });
  });
  return unknown;
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, name),
    animations: "disabled",
  });
}

const SIDEBAR_GROUPS = {
  "Tableau de bord": "Projet",
  Paramètres: "Projet",
  Kanban: "Développement",
  Éditeur: "Développement",
  "Aperçu / Dev": "Développement",
  Branches: "Développement",
  Design: "Design & Planification",
  Plan: "Design & Planification",
  Cockpit: "Opérations & Monitoring",
  Agents: "Aide",
};

async function openSidebarItem(page, label) {
  const group = SIDEBAR_GROUPS[label];
  const header = page.getByRole("button", { name: new RegExp(`^${group},`) });
  if ((await header.getAttribute("aria-expanded")) !== "true") {
    await header.click();
  }
  await page.getByRole("button", { name: new RegExp(`^${label}(:|$)`) }).click();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const unknown = await installApi(page);
  const chat = [
    {
      role: "user",
      text: "Ajoute un badge de statut du daemon dans l’en-tête.",
      task_id: taskId,
    },
    {
      role: "assistant",
      text: "Le badge lit `/api/status` et distingue En ligne / Hors ligne. Le diff est prêt pour la revue.",
      task_id: taskId,
      studio_diff: {
        task_id: taskId,
        captured_at: "2026-10-14T10:30:00Z",
        files: [
          {
            path: "src/App.tsx",
            status: "modified",
            truncated: false,
            diff: "@@ -1,3 +1,8 @@\n-export function Header() {\n+export function Header({ online }: { online: boolean }) {\n+  return <span>{online ? \"En ligne\" : \"Hors ligne\"}</span>;\n }\n",
          },
        ],
      },
      suggested_actions: [{ id: "preview", label: "Ouvrir l’aperçu", kind: "ui", ui_action: "open_preview" }],
    },
    {
      role: "user",
      text: "Variante compacte, uniquement dans l’en-tête.",
      task_id: forkTaskId,
      fork_parent_task_id: taskId,
      fork_cut_index: 1,
    },
  ];
  await page.addInitScript(
    ({ storageKey, messages, projectId: storedProject }) => {
      localStorage.setItem(storageKey, JSON.stringify(messages));
      localStorage.setItem("akasha-code-studio:last-project-id", storedProject);
      localStorage.setItem("akasha-studio-sidebar-open", "1");
      localStorage.setItem("studio.centerTab", "dashboard");
      localStorage.setItem("studio.uiDensity", "normal");
    },
    {
      storageKey: `akasha-code-studio-chat-v2:${projectId}`,
      messages: chat,
      projectId,
    },
  );

  await page.goto(baseURL);
  await page.getByRole("heading", { name: "Code Studio" }).waitFor();
  await page.getByText("Atelier", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Plein éditeur" }).click();
  await page.getByRole("region", { name: "Cycle de livraison" }).waitFor();
  await shot(page, "dashboard.png");

  await openSidebarItem(page, "Éditeur");
  await page.getByRole("button", { name: "App.tsx", exact: true }).click();
  await page.getByRole("button", { name: "api.ts", exact: true }).click();
  await page.locator(".monaco-editor").first().waitFor({ timeout: 20_000 });
  await shot(page, "editor.png");

  await page.getByRole("button", { name: "index.html", exact: true }).click();
  await openSidebarItem(page, "Aperçu / Dev");
  await page.locator('iframe[title="Aperçu"]').waitFor();
  await shot(page, "preview.png");

  await openSidebarItem(page, "Kanban");
  await page.getByText("Brancher le badge sur /api/status").waitFor();
  await shot(page, "kanban.png");

  await openSidebarItem(page, "Plan");
  await page.getByText("Plan Atelier").waitFor();
  await shot(page, "plan.png");

  await openSidebarItem(page, "Design");
  await page.getByText("Atelier").first().waitFor();
  await shot(page, "design.png");

  await openSidebarItem(page, "Branches");
  await page.getByText("studio/badge-statut").first().waitFor();
  await shot(page, "branches.png");

  await openSidebarItem(page, "Cockpit");
  await page.getByRole("region", { name: "Isolation des tâches parallèles" }).waitFor();
  await page.getByRole("cell", { name: "Revue nocturne" }).waitFor();
  await shot(page, "cockpit.png");

  await openSidebarItem(page, "Agents");
  await page.getByRole("table").waitFor();
  await shot(page, "agents.png");

  await openSidebarItem(page, "Tableau de bord");
  await page.setViewportSize({ width: 1680, height: 1100 });
  await page.getByRole("button", { name: "Plein chat" }).click();
  const reviewButton = page.getByRole("button", { name: "Revue de la tâche — afficher" });
  await reviewButton.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await reviewButton.click({ force: true });
  await page.getByText("exécuté").first().waitFor();
  await page.getByPlaceholder("Décrivez ce que l’agent doit créer ou modifier").fill(
    "Ajuste le badge dans @src/App.tsx sans toucher au reste.",
  );
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByPlaceholder("gpt-4o-mini, qwen3:8b, ...").fill("qwen3:8b");
  await page.getByPlaceholder("Ex. ne pas toucher au dossier legacy/…").fill("token: secret-demo — rester dans src/");
  await page.getByRole("button", { name: "Masquer options" }).click();
  const reviewToggle = page.getByRole("button", { name: /Revue de la tâche/ });
  await reviewToggle.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await shot(page, "chat.png");

  await browser.close();
  if (unknown.size > 0) {
    console.log("Unmocked API calls:");
    for (const item of unknown) console.log(`  ${item}`);
  }
  console.log(`Screenshots written to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
