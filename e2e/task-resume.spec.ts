import { test, expect, type Page } from "@playwright/test";

const demoId = "00000000-0000-4000-8000-000000000001";
/** Distinct de `demoId` (projet) pour que le compteur GET /api/tasks ne soit pas réinitialisé au reload de page. */
const runTaskId = "10000000-0000-4000-8000-000000000099";
let taskGetCount = 0;

async function mockStudioBase(page: Page) {
  await page.route("**/api/**", route => route.fulfill({ status: 404, json: { error: "unconfigured_fixture" } }));
  await page.route("**/api/trust-access", route => route.fulfill({ json: { channel_permissions_mode: "ask_me" } }));
  await page.route("**/api/studio/projects", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projects: [{ id: demoId, name: "Démo E2E", path: `/tmp/studio/${demoId}` }],
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route(
    (url) => {
      try {
        const p = new URL(url).pathname.replace(/\/$/, "");
        return p === `/api/studio/projects/${demoId}`;
      } catch {
        return false;
      }
    },
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: demoId,
            name: "Démo E2E",
            created_at: "2020-01-01T00:00:00Z",
            evolutions: [],
            tech_stack: null,
            git_branch: "main",
            git_worktree_clean: true,
          }),
        });
        return;
      }
      await route.continue();
    },
  );

  await page.route(`**/api/studio/projects/${demoId}/files`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ files: ["index.html"] }),
    });
  });

  await page.route(`**/api/studio/projects/${demoId}/raw**`, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, path: "index.html" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        path: "index.html",
        mime: "text/html",
        content: "<!DOCTYPE html><html><body><h1>X</h1></body></html>",
      }),
    });
  });

  await page.route(`**/api/studio/projects/${demoId}/code-rag/status`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        files_indexed: 1,
        chunks_indexed: 1,
        built_at: "2020-01-02T00:00:00Z",
        stale: false,
      }),
    });
  });

  await page.route(`**/api/studio/projects/${demoId}/code-rag/reindex`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        files_indexed: 1,
        chunks_indexed: 2,
        built_at: "2020-01-03T00:00:00Z",
        stale: false,
      }),
    });
  });

  await page.route("**/api/message", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ack: true, task_id: runTaskId, session_id: "t", message: "ok" }),
    });
  });

  await page.route(`**/api/tasks/${runTaskId}/human-input`, async (route) => {
    await route.fulfill({ status: 404, body: "" });
  });

  await page.route("**/api/pending-human-input", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pending: [] }),
    });
  });

  await page.route("**/api/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", version: "0.0.0-e2e" }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  taskGetCount = 0;
  await mockStudioBase(page);

  await page.route(url => url.pathname === `/api/tasks/${runTaskId}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    taskGetCount += 1;
    const running = taskGetCount < 5;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        task_id: runTaskId,
        status: running ? "running" : "completed",
        assigned_agent: "studio_scaffold",
        progress: running
          ? [{ progress_pct: 50, message: "Mock — en cours" }]
          : [{ progress_pct: 100, message: "Mock — terminé après reprise" }],
      }),
    });
  });
});

test("reload resumes polling until task completes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Choisir un projet" })).toContainText("Démo E2E");
  await page.locator(".chat-form textarea").fill("resume e2e");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const activity = page.locator(".chat-activity-area");
  await expect(activity.locator(".chat-task-status > summary")).toContainText(/^En cours/, { timeout: 8000 });
  const activeTaskKey = `akasha-code-studio-task-v1:${demoId}`;
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null")?.taskId, activeTaskKey)).toBe(runTaskId);
  const requestsBeforeReload = taskGetCount;
  await page.reload();
  await expect(page.getByRole("button", { name: "Choisir un projet" })).toContainText("Démo E2E");
  await expect(activity.locator(".chat-task-status > summary")).toContainText(/En cours|terminé|vérifié/i, {
    timeout: 12_000,
  });
  await expect(page.locator(".bubble.assistant").getByText(/terminé|Mock/i).first()).toBeVisible({
    timeout: 20_000,
  });
  expect(taskGetCount).toBeGreaterThan(requestsBeforeReload);
  expect(await page.evaluate(key => localStorage.getItem(key), activeTaskKey)).toBeNull();
});

test("local context preflight points to model selection without retrying the same task", async ({ page }) => {
  await page.route("**/api/router/studio-options", route => route.fulfill({ json: {
    schema_version: 1, goals: true, actions: true,
    models: [{ provider: "ollama", model: "qwen3.5:9b", context_window_tokens: 8192 }],
  } }));
  await page.route(`**/api/tasks/${runTaskId}`, route => route.fulfill({ json: {
    task_id: runTaskId,
    status: "failed",
    assigned_agent: "studio_project_manager",
    failure_detail: "context_window_exceeded: context_window_preflight_rejected: estimated input exceeds configured window",
    progress: [],
    outcome: { schema_version: 1, termination_reason: "provider_error", result: "failed", verification: [] },
  } }));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Choisir un projet" })).toContainText("Démo E2E");
  await page.locator(".chat-form textarea").fill("Créer une petite application de suivi");
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();

  await page.locator(".chat-task-status > summary").click();
  await expect(page.locator(".task-recovery-context")).toContainText("Aucun appel au modèle ni outil");
  await page.getByRole("button", { name: "Choisir un modèle", exact: true }).first().click();
  const modelSelect = page.getByRole("combobox", { name: "Modèle de la tâche" });
  await expect(modelSelect).toBeFocused();
  await modelSelect.selectOption({ label: "qwen3.5:9b · ollama" });
  await expect(page.locator(".composer-model-note")).toContainText("8 192 tokens");
});

test("active task defaults to ticketed follow-up and steering stays available", async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/message", async route => {
    sent.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ack: true,
        task_id: runTaskId,
        session_id: "t",
        studio_ticket_id: "ticket-12345678",
        message: "ok",
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Choisir un projet" })).toContainText("Démo E2E");
  const delivery = page.getByLabel("Livraison message (tâche en cours)");
  await page.locator(".chat-form textarea").fill("resume e2e");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.locator(".chat-task-status > summary")).toContainText(/^En cours/, { timeout: 8000 });
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await expect(delivery).toHaveValue("follow_up");
  await page.locator(".chat-form textarea").fill("Une scène supplémentaire serait utile.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toMatchObject({
    queue_mode: "follow_up",
    message_delivery_mode: "follow_up",
    target_task_id: runTaskId,
  });
  await expect(page.getByRole("button", { name: "Ticket Kanban · ticket-1" }).last()).toBeVisible();

  await delivery.selectOption("steering");
  await expect(delivery).toHaveValue("steering");
  await page.locator(".chat-form textarea").fill("Continue la tâche active avec le code déjà lu.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect.poll(() => sent.length).toBe(3);
  expect(sent[2]).toMatchObject({
    queue_mode: "steering",
    message_delivery_mode: "steering",
    target_task_id: runTaskId,
  });
});
