import { test, expect, type Page } from "@playwright/test";

const demoId = "00000000-0000-4000-8000-000000000001";

test.beforeEach(async ({ page }) => {
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
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: demoId, path: `/tmp/studio/${demoId}` }),
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
      const m = route.request().method();
      if (m === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: demoId,
            name: "Démo E2E",
            created_at: "2020-01-01T00:00:00Z",
            evolutions: [],
            tech_stack: "React + Vite",
            git_branch: "main",
            git_worktree_clean: true,
          }),
        });
        return;
      }
      if (m === "PATCH") {
        await route.fulfill({ status: 200, body: "{}" });
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
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, path: "index.html" }),
      });
      return;
    }
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
        content: "<!DOCTYPE html><html><body><h1>Studio</h1></body></html>",
      }),
    });
  });

  await page.route(`**/api/studio/projects/${demoId}/preview/**`, async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
    const method = route.request().method();
    if (method === "GET" && path.endsWith("/preview/logs")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ running: false, log: "", preview_inactive: true }),
      });
      return;
    }
    if (method === "POST" && path.endsWith("/preview/start")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, url: "http://127.0.0.1:5180", port: 5180 }),
      });
      return;
    }
    if (method === "POST" && path.endsWith("/preview/stop")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, stopped: true }),
      });
      return;
    }
    if (method === "POST" && path.endsWith("/preview/install")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, skipped: true, reason: "node_modules_present" }),
      });
      return;
    }
    await route.continue();
  });

  await page.route(`**/api/studio/projects/${demoId}/build`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ exit_code: 0, stdout: "mock build", stderr: "" }),
    });
  });

  await page.route(`**/api/studio/projects/${demoId}/evolutions`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ evolutions: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ evolution_id: "evo-1", branch: "studio/demo" }),
    });
  });

  await page.route("**/api/message", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ack: true, task_id: demoId, session_id: "t", message: "ok" }),
    });
  });

  await page.route(`**/api/tasks/${demoId}/human-input`, async (route) => {
    await route.fulfill({ status: 404, body: "" });
  });

  await page.route(`**/api/tasks/${demoId}/human-reply`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/tasks/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        task_id: demoId,
        status: "completed",
        assigned_agent: "studio_scaffold",
        progress: [{ progress_pct: 100, message: "Mock — tâche terminée" }],
      }),
    });
  });

  await page.route("**/api/pending-human-input", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pending: [] }),
    });
  });
});

async function selectDemoProject(page: Page) {
  await page.getByTestId("studio-load-project").click();
  await page.getByRole("button", { name: /Démo E2E/i }).click();
}

test("loads layout and lists mocked project", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Code Studio/i })).toBeVisible();
  await page.getByTestId("studio-load-project").click();
  await expect(page.getByRole("button", { name: /Démo E2E/i })).toBeVisible();
});

test("loads project tech stack from metadata", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.getByRole("button", { name: /Paramètres du projet/i }).click();
  const stackArea = page.locator(".stack-textarea");
  await expect(stackArea).toBeVisible();
  await expect(stackArea).toHaveValue("React + Vite");
});

test("opens index.html and shows preview title", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.getByRole("button", { name: "index.html", exact: true }).click();
  await page.getByRole("tab", { name: /^Aperçu$/i }).click();
  await expect(page.locator('iframe[title="Aperçu"]').contentFrame().getByRole("heading", { name: "Studio" })).toBeVisible({
    timeout: 10_000,
  });
});

test("saves editor changes with PUT /raw", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.getByRole("button", { name: "index.html", exact: true }).click();
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("End");
  await page.keyboard.type("<!-- e2e-save -->");

  const put = page.waitForRequest(
    (r) => r.url().includes(`/api/studio/projects/${demoId}/raw`) && r.method() === "PUT",
  );
  await page.getByTestId("studio-save-file").click();
  const req = await put;
  const body = req.postDataJSON() as { content?: string };
  expect(body.content ?? "").toContain("<!-- e2e-save -->");
});

test("sends chat message to daemon (mocked)", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.locator(".chat-form textarea").fill("Hello scaffold");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.locator(".bubble.assistant").getByText(/Mock — tâche terminée|La tâche est terminée/i)).toBeVisible({
    timeout: 10_000,
  });
});

test("deletes file via DELETE /raw (mocked)", async ({ page }) => {
  const del = page.waitForRequest(
    (r) => r.url().includes(`/api/studio/projects/${demoId}/raw`) && r.method() === "DELETE",
  );
  await page.goto("/");
  await selectDemoProject(page);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("studio-delete-file").click();
  await del;
});
