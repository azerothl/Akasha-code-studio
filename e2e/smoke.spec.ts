import { test, expect, type Page } from "@playwright/test";

const demoId = "00000000-0000-4000-8000-000000000001";

test.beforeEach(async ({ page }) => {
  const rawFiles: Record<string, string> = {
    "index.html": "<!DOCTYPE html><html><body><h1>Studio</h1></body></html>",
    "DESIGN.md": "---\nname: Demo\ncolors:\n  primary: \"#8b5cf6\"\ntypography:\n  body: {}\n---\n\n## Overview\nDemo.\n",
  };
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
            git_worktree_lines: [],
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
    const url = new URL(route.request().url());
    const path = url.searchParams.get("path") ?? "index.html";
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as { content?: string };
      rawFiles[path] = body.content ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, path }),
      });
      return;
    }
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, path }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        path,
        mime: path.endsWith(".md") ? "text/markdown" : "text/html",
        content: rawFiles[path] ?? "",
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

  await page.route(`**/api/studio/projects/${demoId}/code-rag/status`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        files_indexed: 2,
        chunks_indexed: 5,
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
        files_indexed: 2,
        chunks_indexed: 6,
        built_at: "2020-01-03T00:00:00Z",
        stale: false,
      }),
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
    const url = route.request().url();
    if (url.endsWith("/human-input") || url.endsWith("/human-reply")) {
      await route.continue();
      return;
    }
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (url.includes("/events")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          events: [
            {
              event_type: "sub_agent_spawned",
              at: "2020-01-01T00:00:00Z",
              task_id: `${demoId}-sub-1`,
              payload: { task_id: `${demoId}-sub-1`, agent_type: "studio_frontend", step_id: "1" },
            },
            {
              event_type: "tool_call",
              at: "2020-01-01T00:00:01Z",
              task_id: `${demoId}-sub-1`,
              payload: { tool_name: "read_file", path: "index.html" },
            },
            {
              event_type: "tool_call",
              at: "2020-01-01T00:00:02Z",
              task_id: `${demoId}-sub-1`,
              payload: { tool_name: "read_file", path: "index.html" },
            },
          ],
        }),
      });
      return;
    }
    if (url.includes("/studio-diff")) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "no_snapshot", task_id: demoId }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        task_id: demoId,
        status: "completed",
        assigned_agent: "studio_scaffold",
        progress: [
          { progress_pct: 60, message: "Analyse du dépôt", task_id: demoId },
          { progress_pct: 60, message: "Analyse du dépôt", task_id: demoId },
          { progress_pct: 100, message: "Mock — tâche terminée", task_id: demoId },
          { progress_pct: 100, message: "Mock — tâche terminée", task_id: demoId },
        ],
        suggested_actions: [
          { id: "open-ed", label: "Ouvrir l’éditeur", kind: "ui", ui_action: "open_editor" },
          { id: "msg-1", label: "Continuer", kind: "message", message: "Poursuivre le scaffold" },
        ],
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

  await page.route("**/api/schedules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schedules: [] }),
    });
  });

  await page.route("**/api/task_runs", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ task_runs: [] }),
    });
  });

  await page.route("**/api/process/watch/recent**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events: [] }),
    });
  });

  await page.route("**/api/terminal/capabilities", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ shells: ["bash"] }),
    });
  });

  await page.route("**/api/tools/effective", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tools: [] }),
    });
  });

  await page.route("**/api/memory/recall-metrics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hits: 0, empty: 0 }),
    });
  });

  await page.route("**/api/mcp/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        config_present: false,
        config_path: "/tmp/mcp.json",
        valid: null,
        server_count: 0,
        runtime: "stdio_probe_validate_and_optional_long_lived",
      }),
    });
  });

  await page.route("**/api/mcp/runtime", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stdio_server: null, oauth: { mode: "documented_vault_reserved" } }),
    });
  });

  await page.route("**/api/lifecycle/hooks", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ present: false, executed_phases: ["on_schedule_fire"] }),
    });
  });
});

async function selectDemoProject(page: Page) {
  await page.getByTestId("studio-project-settings-menu").click();
  await page.getByTestId("studio-load-project").click();
  await page.getByRole("button", { name: /Démo E2E/i }).click();
}

test("loads layout and lists mocked project", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Code Studio/i })).toBeVisible();
  await page.getByTestId("studio-project-settings-menu").click();
  await page.getByTestId("studio-load-project").click();
  await expect(page.getByRole("button", { name: /Démo E2E/i })).toBeVisible();
});

test("loads project tech stack from metadata", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.getByTestId("studio-project-settings-menu").click();
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

test("opens Design tab and saves DESIGN.md", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.getByRole("tab", { name: /^Design$/i }).click();
  const area = page.getByLabel("Contenu de DESIGN.md");
  await expect(area).toBeVisible();
  await area.fill("---\nname: Updated\ncolors:\n  primary: \"#06b6d4\"\ntypography:\n  body: {}\n---\n\n## Overview\nUpdated\n");
  const put = page.waitForRequest(
    (r) =>
      r.url().includes(`/api/studio/projects/${demoId}/raw`) &&
      r.url().includes("path=DESIGN.md") &&
      r.method() === "PUT",
  );
  await page.getByTestId("studio-save-design").click();
  await put;
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

test("opens Git worktree popover (empty state)", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.getByTestId("studio-git-worktree-toggle").click();
  const popover = page.getByRole("dialog", { name: /État du worktree Git/i });
  await expect(popover).toBeVisible();
  await expect(popover.getByText(/Aucune modification détectée/i)).toBeVisible();
});

test("opens task detail modal and shows mocked event", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.locator(".chat-form textarea").fill("Hello scaffold");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const detailBtn = page.locator(".bubble.assistant").getByRole("button", { name: /Détails de la tâche/i });
  await expect(detailBtn).toBeVisible({ timeout: 10_000 });
  await detailBtn.click();
  const modal = page.getByRole("dialog", { name: /Détail de la tâche/i });
  await expect(modal).toBeVisible();
  await expect(modal.locator(".task-detail-events-category-title").filter({ hasText: /^Sous-agents$/ })).toBeVisible({
    timeout: 5_000,
  });
  await expect(modal.locator(".task-detail-events-category-title").filter({ hasText: /^Outils$/ })).toBeVisible();
  await expect(modal.locator(".task-detail-event-group-title").filter({ hasText: /^tool_call$/ })).toBeVisible();
});

test("shows suggested action chips and clicking message chip fills input", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.locator(".chat-form textarea").fill("Hello scaffold");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const suggestionsArea = page.locator(".chat-suggestions");
  await expect(suggestionsArea).toBeVisible({ timeout: 10_000 });
  const messageChip = suggestionsArea.getByRole("button", { name: /Continuer/i });
  await expect(messageChip).toBeVisible();
  await messageChip.click();
  await expect(page.locator(".chat-form textarea")).toHaveValue("Poursuivre le scaffold");
});

test("shows Hermes cockpit in dedicated section and endpoint blocks", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  const panel = page.locator(".cockpit-dedicated-panel .hermes-ops-panel");
  await expect(panel).toBeVisible({ timeout: 5_000 });
  await expect(panel.locator("details").filter({ hasText: "GET /api/schedules" })).toBeVisible({ timeout: 8_000 });
  await expect(panel.locator("details").filter({ hasText: "GET /api/tools/effective" })).toBeVisible();
  await expect(panel.locator("details").filter({ hasText: "GET /api/memory/recall-metrics" })).toBeVisible();
  await expect(panel.locator("details").filter({ hasText: "GET /api/mcp/status" })).toBeVisible();
  await expect(panel.locator("details").filter({ hasText: "GET /api/mcp/runtime" })).toBeVisible();
});

test("restores last selected project from localStorage", async ({ page }) => {
  await page.addInitScript((id) => {
    localStorage.setItem("akasha-code-studio:last-project-id", id as string);
  }, demoId);
  await page.goto("/");
  await expect(page.locator(".sandbox-reminder")).toContainText(demoId.slice(0, 8));
});
