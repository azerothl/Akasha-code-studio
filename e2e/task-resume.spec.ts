import { test, expect, type Page } from "@playwright/test";

const demoId = "00000000-0000-4000-8000-000000000001";
/** Distinct de `demoId` (projet) pour que le compteur GET /api/tasks ne soit pas réinitialisé au reload de page. */
const runTaskId = "10000000-0000-4000-8000-000000000099";
let taskGetCount = 0;

async function mockStudioBase(page: Page) {
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
}

test.beforeEach(async ({ page }) => {
  taskGetCount = 0;
  await mockStudioBase(page);

  await page.route(`**/api/tasks/${runTaskId}*`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = route.request().url();
    if (url.includes("/studio-diff")) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "no_snapshot", task_id: runTaskId }),
      });
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
  await expect(page.locator(".sandbox-reminder")).toContainText(demoId.slice(0, 8));
  await page.locator(".chat-form textarea").fill("resume e2e");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/Requête acceptée|Tâche en cours|en cours/i).first()).toBeVisible({ timeout: 8000 });
  await page.reload();
  await expect(page.locator(".sandbox-reminder")).toContainText(demoId.slice(0, 8));
  await expect(page.getByText(/reprise après rechargement|Mock — en cours|terminé/i).first()).toBeVisible({
    timeout: 12_000,
  });
  await expect(page.locator(".bubble.assistant").getByText(/terminé|Mock/i).first()).toBeVisible({
    timeout: 20_000,
  });
});
