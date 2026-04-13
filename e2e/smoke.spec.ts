import { test, expect } from "@playwright/test";

const demoId = "00000000-0000-4000-8000-000000000001";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/studio/projects", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projects: [{ id: demoId, path: `/tmp/studio/${demoId}` }],
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

  await page.route(`**/api/studio/projects/${demoId}/files`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ files: ["index.html"] }),
    });
  });

  await page.route(`**/api/studio/projects/${demoId}/raw**`, async (route) => {
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
});

test("loads layout and lists mocked project", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Akasha Code Studio/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /00000000/i })).toBeVisible();
});

test("opens index.html and shows preview title", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /00000000/i }).click();
  await page.getByRole("button", { name: "index.html" }).click();
  await expect(page.locator("iframe[title=preview]").contentFrame().getByRole("heading", { name: "Studio" })).toBeVisible({
    timeout: 10_000,
  });
});

test("sends chat message to daemon (mocked)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /00000000/i }).click();
  await page.locator(".chat-form textarea").fill("Hello scaffold");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/Tâche/)).toBeVisible();
});
