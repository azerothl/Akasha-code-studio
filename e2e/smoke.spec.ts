import { test, expect, type Page } from "@playwright/test";

const demoId = "00000000-0000-4000-8000-000000000001";

test("tool approval reply keeps the request identifier from the current question", async ({ page }) => {
  let reply: Record<string, unknown> | null = null;
  await page.route(`**/api/tasks/${demoId}/human-input`, route => route.fulfill({ json: {
    task_id: demoId, request_id: "fresh-approval-42", question: "Autoriser cette écriture ?", context: "write_file", choices: ["Approuver", "Refuser"],
  } }));
  await page.route(`**/api/tasks/${demoId}/human-reply`, route => {
    reply = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  await selectDemoProject(page);
  await page.locator(".chat-form textarea").fill("Valider l’écriture demandée");
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.locator(".task-human-input-question")).toHaveText("Autoriser cette écriture ?");
  await page.locator(".task-human-input-choices").getByRole("button", { name: "Approuver", exact: true }).click();
  await page.locator(".task-human-input-submit").click();
  await expect.poll(() => reply).toMatchObject({ response: "Approuver", request_id: "fresh-approval-42" });
});

test("stale approval refreshes the question and requires a new user decision", async ({ page }) => {
  let phase=0;
  const ids: unknown[]=[];
  await page.route(`**/api/tasks/${demoId}/human-input`, route => phase===2 ? route.fulfill({status:404,body:""}) : route.fulfill({json:{
    task_id:demoId,request_id:phase===0?"old-request":"new-request",question:phase===0?"Ancienne écriture ?":"Nouvelle écriture à examiner ?",context:"write_file",choices:["Approuver","Refuser"],
  }}));
  await page.route(`**/api/tasks/${demoId}/human-reply`, route => {
    ids.push((route.request().postDataJSON() as {request_id:string}).request_id);
    phase+=1;
    return route.fulfill(phase===1?{status:409,json:{error:"stale_approval_request"}}:{json:{ok:true}});
  });
  await page.goto("/");await selectDemoProject(page);
  await page.locator(".chat-form textarea").fill("Vérifier la demande");
  await page.getByRole("button",{name:"Envoyer",exact:true}).click();
  await expect(page.locator(".task-human-input-question")).toHaveText("Ancienne écriture ?");
  await page.locator(".task-human-input-choices").getByRole("button",{name:"Approuver",exact:true}).click();
  await page.locator(".task-human-input-submit").click();
  await expect(page.locator(".task-human-input-question")).toHaveText("Nouvelle écriture à examiner ?");
  await expect(page.locator(".task-human-input-textarea")).toHaveValue("");
  await expect(page.locator(".task-human-input-submit")).toBeDisabled();
  expect(ids).toEqual(["old-request"]);
  await page.locator(".task-human-input-choices").getByRole("button",{name:"Approuver",exact:true}).click();
  await page.locator(".task-human-input-submit").click();
  await expect.poll(()=>ids).toEqual(["old-request","new-request"]);
});

test("semantic rename button submits the preview request before applying edits", async ({ page }) => {
  await page.route(`**/api/studio/projects/${demoId}/files`, route => route.fulfill({ json: { files: ["sample.ts"] } }));
  await page.route(`**/api/studio/projects/${demoId}/raw**`, route => route.fulfill({ json: { content: "const value = 1;\n" } }));
  await page.route(`**/api/studio/projects/${demoId}/lsp/query`, route => {
    const request = route.request().postDataJSON() as { action: string };
    return route.fulfill({ json: { schema_version: 1, result: request.action === "diagnostics"
      ? { status: "ready", diagnostics: [] }
      : { status: "planned", plan_id: "00000000-0000-4000-8000-000000000099", files: [{ path: "sample.ts", before: "const value = 1;", after: "const renamed = 1;", edit_count: 1 }] } } });
  });
  await page.goto("/");
  await selectDemoProject(page);
  await page.getByRole("button", { name: "sample.ts", exact: true }).click();
  await page.locator(".monaco-editor").waitFor();
  await page.getByText("Analyse sémantique LSP", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Activer le serveur pour ce projet" }).check();
  await page.getByLabel("Nouveau nom", { exact: true }).fill("renamed");
  const sent = page.waitForRequest(request => request.url().endsWith("/lsp/query") && request.postDataJSON()?.action === "rename");
  await page.getByRole("button", { name: "Préparer le renommage", exact: true }).click();
  expect((await sent).postDataJSON()).toMatchObject({ action: "rename", path: "sample.ts", new_name: "renamed" });
  await expect(page.getByRole("button", { name: "Appliquer ce plan", exact: true })).toBeVisible();
});

test("project tools stay disclosed on demand and restore keyboard focus", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Choisir un projet" })).toContainText("Démo E2E");
  const trigger = page.getByRole("button", { name: "Outils du projet", exact: true });
  const tools = page.getByRole("dialog", { name: "Outils du projet", exact: true });
  await expect(tools).not.toBeVisible();
  await expect(page.getByTestId("studio-code-rag-badge")).not.toBeVisible();
  await trigger.click();
  await expect(tools).toBeVisible();
  await expect(page.getByTestId("studio-code-rag-badge")).toBeVisible();
  // Tab stays in the dialog; programmatic focus on background content is blocked.
  await tools.getByRole("button", { name: "Fermer les outils" }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await trigger.focus();
  expect(await tools.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(tools).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("mobile navigation preserves the draft and gives the editor room", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Choisir un projet" })).toContainText("Démo E2E");
  const navigation = page.getByRole("navigation", { name: "Navigation mobile" });
  const draft = page.getByRole("textbox", { name: "Message à l’agent" });
  await draft.fill("Conserver mon brouillon pendant la revue");
  await navigation.getByRole("button", { name: "Fichiers", exact: true }).click();
  await page.getByRole("button", { name: "index.html", exact: true }).click();
  await expect(page.locator(".editor-file-pane")).not.toHaveAttribute("open", "");
  await expect(page.locator(".editor-open-path")).toContainText("index.html");
  const editor = await page.locator(".editor-editor-pane").boundingBox();
  expect(editor && editor.height > 844 / 2).toBe(true);
  await navigation.getByRole("button", { name: "Aperçu", exact: true }).click();
  await expect(page.locator('iframe[title="Aperçu"]').contentFrame().getByRole("heading", { name: "Studio" })).toBeVisible();
  await navigation.getByRole("button", { name: "Discussion", exact: true }).click();
  await expect(draft).toHaveValue("Conserver mon brouillon pendant la revue");
  const bounds = await navigation.boundingBox();
  expect(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 844).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("worker integration requires a terminal worker and an explicit review", async ({ page }) => {
  const record = { root_task_id: "root", project_id: demoId, project_root: "/fixture", base_branch: "main", base_sha: "a".repeat(40), worktree_path: "/fixture/worker" };
  await page.route(`**/api/studio/projects/${demoId}/worktrees`, route => route.fulfill({ json: { worktrees: [
    { ...record, task_id: "ready", worktree_branch: "wt/ready", lifecycle_state: "awaiting_review" },
    { ...record, task_id: "active", worktree_branch: "wt/active", lifecycle_state: "active" },
  ] } }));
  await page.route(`**/api/studio/projects/${demoId}/worktrees/ready/integrate`, route => route.fulfill({ json: { ok: true } }));
  await page.goto("/");
  await selectDemoProject(page);
  await openSection(page, /Opérations & Monitoring/i, /^Cockpit$/);
  const ready = page.locator(".swarm-isolation-item").filter({ hasText: "wt/ready" });
  const active = page.locator(".swarm-isolation-item").filter({ hasText: "wt/active" });
  await expect(ready.getByRole("button", { name: "Intégrer", exact: true })).toBeDisabled();
  await expect(active.getByRole("button", { name: "Intégrer", exact: true })).toHaveCount(0);
  await ready.getByText("Examiner avant intégration", { exact: true }).click();
  await ready.getByRole("checkbox").check();
  const request = page.waitForRequest(req => req.url().endsWith("/worktrees/ready/integrate") && req.method() === "POST");
  await ready.getByRole("button", { name: "Intégrer", exact: true }).click();
  await request;
});

test("fork branches show hierarchy, statuses and the complete retained transcript", async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem("akasha-code-studio-chat-v2:" + id, JSON.stringify([
      { role: "user", text: "Parent demande", task_id: "parent", task_status: "completed" },
      { role: "assistant", text: "Réponse parent", task_id: "parent", task_status: "completed" },
      { role: "user", text: "Enfant demande", task_id: "child", fork_parent_task_id: "parent", fork_cut_index: 0 },
      { role: "assistant", text: "Texte conservé ".repeat(30) + "fin-transcript", task_id: "child", task_status: "completed" },
    ]));
  }, { id: demoId });
  await page.goto("/");
  await selectDemoProject(page);
  await expect(page.locator(".fork-tree-children")).toHaveCount(1);
  await page.locator(".fork-tree > summary").click();
  await page.locator(".fork-tree-children").getByRole("button", { name: /Enfant demande/ }).click();
  const transcript = page.getByRole("region", { name: "Transcript de la branche consultée" });
  await expect(transcript).toContainText("fin-transcript");
  await transcript.getByRole("button", { name: "Revenir au parent" }).click();
  await expect(transcript).toContainText("Réponse parent");
  await expect(page.locator(".chat-log")).toContainText("fin-transcript");
});

test("empty project state guides creation on a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/studio/projects", route => route.fulfill({ json: { projects: [] } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Votre prochain projet commence ici." })).toBeVisible();
  const createBounds = await page.getByRole("button", { name: "Créer un projet", exact: true }).boundingBox();
  expect(createBounds && createBounds.x >= 0 && createBounds.x + createBounds.width <= 390).toBe(true);
  await page.screenshot({ path: "test-results/ui-mobile-empty.png" });
  await page.getByRole("button", { name: "Créer un projet", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("failed sends preserve the draft and expose recovery details", async ({ page }) => {
  await page.route("**/api/message", route => route.fulfill({ status: 503, json: { error: "fixture unavailable" } }));
  await page.goto("/");
  await selectDemoProject(page);
  await page.locator(".chat-form textarea").fill("Conserver cette demande");
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Envoi ou action interrompue" })).toBeVisible();
  await expect(page.locator(".chat-form textarea")).toHaveValue("Conserver cette demande");
  await expect(page.getByRole("button", { name: "Envoyer", exact: true })).toBeEnabled();
  await page.screenshot({ path: "test-results/ui-desktop-recovery.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("navigation", { name: "Navigation mobile" }).getByRole("button", { name: "Discussion" }).click();
  await expect(page.locator(".chat-form textarea")).toBeVisible();
  const composerBounds = await page.locator(".chat-form textarea").boundingBox();
  expect(composerBounds && composerBounds.x >= 0 && composerBounds.x + composerBounds.width <= 390).toBe(true);
  await page.screenshot({ path: "test-results/ui-mobile-chat.png" });
  const options = page.getByRole("button", { name: "Options", exact: true });
  await options.scrollIntoViewIfNeeded();
  const optionsBounds = await options.boundingBox();
  expect(optionsBounds && optionsBounds.y >= 0 && optionsBounds.y + optionsBounds.height <= 844).toBe(true);
});

test("offline daemon has an explicit reconnect action", async ({ page }) => {
  let online = false;
  await page.route("**/api/status", route => route.fulfill({ status: online ? 200 : 503, json: online ? { status: "ok" } : { error: "offline" } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Daemon hors ligne" })).toBeVisible();
  await page.screenshot({ path: "test-results/ui-desktop-offline.png" });
  online = true;
  await page.getByRole("button", { name: "Reconnexion", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Daemon hors ligne" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Daemon : En ligne" })).toBeVisible();
});

test("project search examines files after the first 25", async ({ page }) => {
  await page.route(`**/api/studio/projects/${demoId}/files`, route => route.fulfill({ json: { files: Array.from({ length: 42 }, (_, i) => `file-${i}.txt`) } }));
  await page.route(`**/api/studio/projects/${demoId}/raw**`, async route => {
    const path = new URL(route.request().url()).searchParams.get("path") || "";
    if (!path.endsWith(".txt")) { await route.fallback(); return; }
    await route.fulfill({ json: { content: path === "file-41.txt" ? "only-match-here" : "other" } });
  });
  await page.goto("/");
  await selectDemoProject(page);
  await page.locator(".editor-inspection > summary").click();
  await page.getByLabel("Recherche dans le projet").fill("only-match-here");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page.locator(".editor-search-hits")).toContainText("file-41.txt:1");
  await expect(page.getByText(/42 fichiers examinés/)).toBeVisible();
});

test("a late file response cannot replace the file opened afterwards", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/studio/projects/${demoId}/files`, route => route.fulfill({ json: { files: ["slow.ts", "fast.ts"] } }));
  await page.route(`**/api/studio/projects/${demoId}/raw**`, async route => {
    const path = new URL(route.request().url()).searchParams.get("path") || "";
    if (!path.endsWith(".ts")) { await route.fallback(); return; }
    if (path === "slow.ts") await gate;
    await route.fulfill({ json: { content: `// ${path}` } });
  });
  await page.goto("/");
  await selectDemoProject(page);
  await page.locator(".editor-file-pane").getByRole("button", { name: "slow.ts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ouverture du fichier…" })).toBeVisible();
  await page.locator(".editor-file-pane").getByRole("button", { name: "fast.ts", exact: true }).click();
  await expect(page.locator(".editor-editor-pane")).toContainText("fast.ts");
  const response = page.waitForResponse(res => res.url().includes("path=slow.ts"));
  release();
  await response;
  await expect(page.locator(".editor-editor-pane")).not.toContainText("slow.ts");
});

test("preview failures can be retried without leaving the view", async ({ page }) => {
  let attempts = 0;
  await page.route(`**/api/studio/projects/${demoId}/preview/start`, route => {
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 500, json: { error: "start failed" } } : { json: { ok: true, url: "http://127.0.0.1:5180" } });
  });
  await page.goto("/");
  await selectDemoProject(page);
  await openSection(page, /Développement/i, /^Aperçu \/ Dev/);
  await page.getByRole("button", { name: /Lancer la prévisualisation/ }).click();
  await expect(page.getByRole("heading", { name: "L’aperçu n’est pas prêt" })).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/tickets-preview-error.png", fullPage: true });
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.locator('iframe[title="Aperçu"]')).toHaveAttribute("src", "http://127.0.0.1:5180");
  await expect(page.getByRole("heading", { name: "L’aperçu n’est pas prêt" })).toHaveCount(0);
});

test("a nonzero build exit is an error even without stderr", async ({ page }) => {
  await page.route(`**/api/studio/projects/${demoId}/build`, route => route.fulfill({ status: 500, json: { exit_code: 17, stdout: "", stderr: "" } }));
  await page.goto("/");
  await selectDemoProject(page);
  await openSection(page, /Développement/i, /^Aperçu \/ Dev/);
  await page.getByText("Environnement et vérifications", { exact: true }).click();
  await page.getByRole("button", { name: "Exécuter le build", exact: true }).click();
  await expect(page.getByRole("heading", { name: "La vérification a échoué" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Relancer le build", exact: true })).toBeVisible();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 404, json: { error: "unconfigured_fixture" } }));
  await page.route("**/api/router/studio-options", route => route.fulfill({ json: { schema_version: 1, goals: true, actions: true, models: [{ provider: "fixture", model: "code-test" }] } }));
  await page.route("**/api/trust-access", route => route.fulfill({ json: { channel_permissions_mode: "ask_me" } }));
  await page.route("**/api/studio/projects/*/git/conflicts", route => route.fulfill({ json: { conflict_files: [], merge_in_progress: false } }));
  await page.route("**/api/studio/projects/*/worktrees", route => route.fulfill({ json: { worktrees: [] } }));
  let scheduleEnabled = true;
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

  await page.route(`**/api/studio/projects/${demoId}/tickets/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/review") && method === "POST") {
      const demoTicket = {
        id: "ticket-1",
        project_id: demoId,
        title: "Mock ticket",
        description: "",
        status: "done",
        requested_by: "test",
        assigned_agent: "studio_fullstack",
        review_agent: "studio_reviewer",
        acceptance_criteria: [],
        evidence: {},
        created_at: "2020-01-01T00:00:00Z",
        updated_at: "2020-01-01T00:00:00Z",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ticket: demoTicket }),
      });
      return;
    }
    if (method === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const demoTicket = {
        id: "ticket-1",
        project_id: demoId,
        title: "Mock ticket",
        description: "",
        status: (body.status as string) ?? "todo",
        requested_by: "test",
        assigned_agent: "studio_fullstack",
        review_agent: "studio_reviewer",
        acceptance_criteria: [],
        evidence: {},
        created_at: "2020-01-01T00:00:00Z",
        updated_at: "2020-01-01T00:00:00Z",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ticket: demoTicket }),
      });
      return;
    }
    // GET ticket detail
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ticket: {
          id: "ticket-1",
          project_id: demoId,
          title: "Mock ticket",
          description: "",
          status: "todo",
          requested_by: "test",
          assigned_agent: "studio_fullstack",
          review_agent: "studio_reviewer",
          acceptance_criteria: [],
          evidence: {},
          created_at: "2020-01-01T00:00:00Z",
          updated_at: "2020-01-01T00:00:00Z",
        },
        timeline: [],
      }),
    });
  });

  await page.route(`**/api/studio/projects/${demoId}/tickets`, async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ticket: {
            id: "ticket-new",
            project_id: demoId,
            title: (body.title as string) ?? "New ticket",
            description: (body.description as string) ?? "",
            status: "todo",
            requested_by: (body.requested_by as string) ?? "test",
            assigned_agent: (body.assigned_agent as string) ?? "studio_fullstack",
            review_agent: (body.review_agent as string) ?? "studio_reviewer",
            acceptance_criteria: [],
            evidence: {},
            created_at: "2020-01-01T00:00:00Z",
            updated_at: "2020-01-01T00:00:00Z",
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
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
      await route.fallback();
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
            {
              event_type: "progress_update",
              at: "2020-01-01T00:00:03Z",
              task_id: `${demoId}-sub-1`,
              payload: {
                task_id: `${demoId}-sub-1`,
                progress_pct: 50,
                message: "Je corrige le build",
              },
            },
            {
              event_type: "progress_update",
              at: "2020-01-01T00:00:04Z",
              task_id: `${demoId}-sub-1`,
              payload: {
                task_id: `${demoId}-sub-1`,
                progress_pct: 50,
                message: "Je corrige le build en créant les fichiers manquants",
              },
            },
            {
              event_type: "progress_update",
              at: "2020-01-01T00:00:05Z",
              task_id: `${demoId}-sub-1`,
              payload: {
                task_id: `${demoId}-sub-1`,
                progress_pct: 50,
                message: "Je corrige le build en créant les fichiers manquants et en alignant les conventions de nommage.",
              },
            },
            {
              event_type: "progress_update",
              at: "2020-01-01T00:00:06Z",
              task_id: `${demoId}-sub-1`,
              payload: {
                task_id: `${demoId}-sub-1`,
                progress_pct: 80,
                message: "Je vérifie ensuite les imports et les chemins.",
              },
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
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schedules: [{ id: "sched-1", name: "Nightly eval", enabled: scheduleEnabled }],
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/schedules/*/*", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/pause")) scheduleEnabled = false;
    if (path.endsWith("/resume")) scheduleEnabled = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, action: path.split("/").pop() }),
    });
  });

  await page.route("**/api/task_runs", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        task_runs: [
          {
            id: "run-1",
            task_id: "task-42",
            status: "completed",
            started_at: "2020-01-02T10:00:00Z",
            ended_at: "2020-01-02T10:01:00Z",
            summary: "Build + tests",
          },
        ],
      }),
    });
  });

  await page.route("**/api/process/watch/recent**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [{ at: "2020-01-02T10:00:00Z", command: "npm run build", exit_code: 0 }],
      }),
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

  await page.route("**/api/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", version: "0.0.0-e2e" }),
    });
  });

  // Return 404 so EventSource fires onerror and falls back to the already-mocked polling endpoint.
  await page.route("**/api/events", async (route) => {
    await route.fulfill({ status: 404, body: "" });
  });

  await page.route(`**/api/studio/projects/${demoId}/patch/hunks`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, dry_run: false, requested: 1, applied: 1, errors: [] }),
      });
      return;
    }
    await route.continue();
  });
});

async function selectDemoProject(page: Page) {
  await page.getByRole("button", { name: "Outils du projet", exact: true }).click();
  await page.getByTestId("studio-project-settings-menu").click();
  await page.getByTestId("studio-load-project").click();
  await page.getByTestId(`studio-project-${demoId}`).click();
  await openSection(page, /Développement/i, /^Éditeur/);
}

async function openSection(page: Page, group: RegExp, destination: RegExp) {
  if (!await page.getByRole("navigation", { name: "Navigation principale", exact: true }).isVisible()) await page.getByRole("button", { name: "Ouvrir/fermer le menu" }).click();
  if (!await page.locator(".sidebar-more").evaluate(element => (element as HTMLDetailsElement).open)) await page.locator(".sidebar-more > summary").click();
  const header = page.locator(".sidebar-group-header").filter({ hasText: group });
  if (await header.getAttribute("aria-expanded") !== "true") await header.click();
  await page.locator(".sidebar-item-label").filter({ hasText: destination }).click();
}

async function projectSettings(page: Page) {
  await openSection(page, /^Projet$/i, /^Tableau de bord/);
  await page.getByRole("button", { name: /Paramètres du projet/ }).click();
}

test("loads layout and lists mocked project", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".workspace-header")).toBeVisible();
  await page.getByRole("button", { name: "Outils du projet", exact: true }).click();
  await page.getByTestId("studio-project-settings-menu").click();
  await page.getByTestId("studio-load-project").click();
  await expect(page.getByTestId(`studio-project-${demoId}`)).toBeVisible();
});

test("opens integrated documentation tab", async ({ page }) => {
  await page.goto("/");
  await openSection(page, /^Aide$/i, /^Documentation/);
  const docTab = page.getByTestId("studio-doc-tab");
  await expect(docTab).toBeVisible();
  await docTab.click();
  await expect(page.getByTestId("studio-doc-tab")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("studio-doc-content")).toContainText("Akasha Code Studio");
});

test("loads project tech stack from metadata", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await projectSettings(page);
  const stackArea = page.locator(".stack-wizard-textarea");
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

test("POST /api/message includes studio_acceptance_criteria when draft is set", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await projectSettings(page);
  await page.getByTestId("acceptance-criteria-draft").fill("README doit mentionner E2E");
  const post = page.waitForRequest(
    (r) => r.url().includes("/api/message") && r.method() === "POST",
  );
  await page.locator(".chat-form textarea").fill("ping");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const req = await post;
  const body = req.postDataJSON() as { studio_acceptance_criteria?: string };
  expect(body.studio_acceptance_criteria).toBe("README doit mentionner E2E");
});

test("opens Design tab and saves DESIGN.md", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await openSection(page, /Design & Planification/i, /^Design$/);
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
  await page.getByRole("button", { name: "Outils du projet", exact: true }).click();
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
  await modal.getByRole("tab", { name: "Workflow", exact: true }).click();
  const subAgentWorkflowCard = modal
    .locator(".task-detail-workflow-item")
    .filter({ hasText: /Sous-agent/i })
    .first();
  await expect(subAgentWorkflowCard).toBeVisible();
  const progressRows = subAgentWorkflowCard.locator(".task-detail-workflow-progress li");
  await expect(progressRows).toHaveCount(2);
  await expect(subAgentWorkflowCard).toContainText(
    "Je corrige le build en créant les fichiers manquants et en alignant les conventions de nommage.",
  );
  await expect(subAgentWorkflowCard).toContainText("Je vérifie ensuite les imports et les chemins.");
});

test("shows suggested action chips and clicking message chip fills input", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await page.locator(".chat-form textarea").fill("Hello scaffold");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const suggestionsArea = page.locator(".chat-suggestions");
  await expect(suggestionsArea).toBeVisible({ timeout: 10_000 });
  const messageChip = suggestionsArea.getByRole("button", { name: /Continuer/i });
  await suggestionsArea.locator("summary").click();
  await expect(messageChip).toBeVisible();
  await messageChip.click();
  await expect(page.locator(".chat-form textarea")).toHaveValue("Poursuivre le scaffold");
});

test("shows operator cockpit in dedicated section and endpoint blocks", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);
  await openSection(page, /Opérations & Monitoring/i, /^Cockpit$/);
  const panel = page.locator(".preview-pane--cockpit .daemon-ops-panel");
  await expect(panel).toBeVisible({ timeout: 5_000 });
  await expect(panel.getByTestId("ops-task-runs-card")).toContainText(/run-1|Build \+ tests/i);
  await expect(panel.getByTestId("ops-process-watch-card")).toContainText(/npm run build|ok/i);
  await expect(panel.getByTestId("ops-terminal-card")).toBeVisible();
  await expect(panel.getByTestId("ops-tools-card")).toBeVisible();
  await expect(panel.getByTestId("ops-mcp-card")).toBeVisible();
  await expect(panel.getByTestId("ops-lifecycle-card")).toBeVisible();
  await panel.getByRole("button", { name: /Pause/i }).first().click();
  await expect(panel).toContainText(/pause → OK/i);
  await expect(panel.locator("details").filter({ hasText: "GET /api/schedules" })).toBeVisible({ timeout: 8_000 });
  await expect(panel.locator("details").filter({ hasText: "GET /api/tools/effective" })).toBeVisible();
  await expect(panel.locator("details").filter({ hasText: "GET /api/memory/recall-metrics" })).toBeVisible();
  await expect(panel.locator("details").filter({ hasText: "GET /api/mcp/status" })).toBeVisible();
  await expect(panel.locator("details").filter({ hasText: "GET /api/mcp/runtime" })).toBeVisible();
});

test("restores last selected project from localStorage", async ({ page }) => {
  // Remembered project is deliberately not the first fallback in the list.
  await page.route("**/api/studio/projects", route => route.fulfill({ json: { projects: [
    { id: "another-project", name: "Autre projet", path: "/tmp/other" },
    { id: demoId, name: "Démo E2E", path: `/tmp/studio/${demoId}` },
  ] } }));
  await page.addInitScript((id) => {
    localStorage.setItem("akasha-code-studio:last-project-id", id as string);
  }, demoId);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Choisir un projet" })).toContainText("Démo E2E");
});

test("fork dialog sends fork_from_task_id and fork_after_message_index", async ({ page }) => {
  await page.goto("/");
  await selectDemoProject(page);

  // Send a message so a user bubble with task_id is created.
  await page.locator(".chat-form textarea").fill("Implement feature X");
  await page.getByRole("button", { name: "Envoyer" }).click();

  // The fork button (⎇) appears on the user bubble once task_id is set.
  const forkBtn = page.locator(".bubble.user").last().getByRole("button", { name: /Fork à partir de ce message/i });
  await expect(forkBtn).toBeVisible({ timeout: 5_000 });

  // Capture the next POST /api/message to inspect its body.
  const forkRequest = page.waitForRequest(
    (r) => r.url().includes("/api/message") && r.method() === "POST",
  );

  await forkBtn.click();
  const modal = page.getByRole("dialog", { name: /Nouvelle branche de conversation/i });
  await expect(modal).toBeVisible();

  // Replace the default pre-filled instruction and submit.
  const instructionArea = modal.locator("textarea");
  await instructionArea.fill("Continue from a different angle");
  await modal.getByRole("button", { name: /Créer la branche/i }).click();

  const req = await forkRequest;
  const body = req.postDataJSON() as Record<string, unknown>;
  expect(body.fork_from_task_id).toBe(demoId);
  expect(typeof body.fork_after_message_index).toBe("number");
});

test("hunk selection applies selected hunks via POST /patch/hunks", async ({ page }) => {
  // Override studio-diff to return an actual diff with one hunk.
  await page.route(`**/api/tasks/${demoId}/studio-diff`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        task_id: demoId,
        captured_at: "2020-01-01T00:00:00Z",
        files: [
          {
            path: "src/index.ts",
            status: "M",
            truncated: false,
            diff: [
              "diff --git a/src/index.ts b/src/index.ts",
              "--- a/src/index.ts",
              "+++ b/src/index.ts",
              "@@ -1,3 +1,4 @@",
              " const x = 1;",
              "+const y = 2;",
              " export { x };",
            ].join("\n"),
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await selectDemoProject(page);

  await page.locator(".chat-form textarea").fill("Hello scaffold");
  await page.getByRole("button", { name: "Envoyer" }).click();

  // Wait for task to complete and the diff panel toggle to appear.
  await page.getByRole("button", { name: /Revue de la tâche — afficher/ }).click();
  const diffToggle = page.locator(".chat-studio-diff-toggle");
  await expect(diffToggle).toBeVisible({ timeout: 10_000 });
  await diffToggle.click();

  // Select the hunk checkbox (expand the file details first).
  const fileDetails = page.locator(".chat-studio-diff-file").first();
  await expect(fileDetails).toBeVisible();
  await fileDetails.locator("summary").click();
  const hunkCheckbox = page.locator(".chat-studio-diff-hunk input[type=checkbox]").first();
  await expect(hunkCheckbox).toBeVisible();
  await hunkCheckbox.check();
  await page.getByRole("button", { name: "Vérifier (dry-run)" }).click();
  await expect(page.getByRole("button", { name: "Appliquer sélection" })).toBeEnabled();

  // Capture the POST to /patch/hunks.
  const patchRequest = page.waitForRequest(
    (r) => r.url().includes("/patch/hunks") && r.method() === "POST",
  );
  await page.getByRole("button", { name: /Appliquer sélection/i }).click();
  const req = await patchRequest;
  const body = req.postDataJSON() as { patches: string[]; dry_run?: boolean };
  expect(body.patches.length).toBeGreaterThan(0);
  expect(body.dry_run).not.toBe(true);
  await expect(page.locator(".hint").filter({ hasText: /Patch appliqué/i })).toBeVisible({ timeout: 5_000 });
  await expect(hunkCheckbox).toBeDisabled();
});

test("SSE success path delivers live events to task detail modal", async ({ page }) => {
  const sseAt = "2020-06-01T12:00:00Z";
  // Override /api/events to return a real SSE stream with one event.
  await page.route("**/api/events", async (route) => {
    const sseEvent = JSON.stringify({
      id: "sse-test-event-1",
      event_type: "progress_update",
      correlation_id: demoId,
      task_id: `${demoId}-sse-sub`,
      schema_version: 2,
      timestamp: sseAt,
      payload: { message: "SSE live progress" },
    });
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "Cache-Control": "no-cache", "Connection": "keep-alive" },
      // Single SSE message followed by a blank line (end of stream)
      body: `data: ${sseEvent}\n\n`,
    });
  });

  await page.goto("/");
  await selectDemoProject(page);

  // Send a task and open the task-detail modal.
  await page.locator(".chat-form textarea").fill("Hello scaffold");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const detailBtn = page.locator(".bubble.assistant").getByRole("button", { name: /Détails de la tâche/i });
  await expect(detailBtn).toBeVisible({ timeout: 10_000 });
  await detailBtn.click();

  const modal = page.getByRole("dialog", { name: /Détail de la tâche/i });
  await expect(modal).toBeVisible();

  // The SSE event (progress_update at sseAt) should appear in the modal.
  // The task-detail panel groups events by type; progress_update should be visible.
  await expect(modal.locator(".task-detail-event-group-title").filter({ hasText: /progress_update/i })).toBeVisible({
    timeout: 5_000,
  });
});


test("kanban stays inside its pane on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/"); await selectDemoProject(page);
  await openSection(page, /Développement/i, /^Kanban$/);
  await page.getByRole("button", { name: "Vue adaptative", exact: true }).click();
  for (const width of [1440, 1920, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    const track = page.locator(".kanban-columns-grid");
    const bounds = await track.boundingBox(); const pane = await page.locator(".center").boundingBox();
    expect(bounds && pane && bounds.x + bounds.width <= pane.x + pane.width + 1).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  const track = page.locator(".kanban-columns-grid");
  await track.focus(); await track.press("ArrowRight");
  await expect.poll(() => track.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await track.evaluate(element => { element.scrollLeft = 0; });
  await page.screenshot({ path: "docs/screenshots/tickets-kanban-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Navigation principale", exact: true })).not.toBeVisible();
  await expect.poll(async () => (await page.locator(".center").boundingBox())?.width).toBeGreaterThan(350);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "docs/screenshots/tickets-kanban-mobile.png", fullPage: true });
});

test("expanded chat details keep responses and input reachable on desktop and mobile", async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem("akasha-code-studio-chat-v2:" + id, JSON.stringify(Array.from({ length: 5 }, (_, index) => ({
      role: "user", text: `Demande précédente ${index + 1}`, task_id: `branch-${index}`, task_status: "completed",
    }))));
  }, { id: demoId });
  const detail = "Détails du refus d’accès.\n\n" + "Le diagnostic reste consultable sans masquer la saisie.\n\n".repeat(15) + "Fin du diagnostic de la tâche.";
  await page.route(`**/api/tasks/${demoId}`, route => route.fulfill({ json: {
    task_id: demoId, status: "failed", failure_detail: detail, progress: [],
    outcome: { schema_version: 1, termination_reason: "context_unavailable", result: "failed", acceptance_verified: false, verification: [] },
  } }));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/"); await selectDemoProject(page);
  const input = page.getByRole("textbox", { name: "Message à l’agent" });
  await input.fill("Préparer le projet");
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.locator(".task-recovery-context")).toBeAttached();
  await expect(page.locator(".chat-task-status")).toHaveJSProperty("open", false);
  await expect(page.locator(".fork-tree")).toHaveJSProperty("open", false);
  await page.locator(".chat-task-status > summary").click();
  await page.locator(".fork-tree > summary").click();
  await page.locator(".send-context > summary").click();
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await input.fill("/goal Vérifier le projet");
  for (const [width, height] of [[1440, 960], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height });
    if (width < 900) await page.getByRole("navigation", { name: "Navigation mobile" }).getByRole("button", { name: "Discussion", exact: true }).click();
    else await page.getByRole("button", { name: "Vue adaptative", exact: true }).click();
    const reading = page.getByRole("region", { name: "Messages et suivi de l’agent" });
    await expect.poll(async () => (await reading.boundingBox())?.height ?? 0).toBeGreaterThan(height * 0.35);
    await expect(input).toBeInViewport({ ratio: 1 });
    const lastLine = page.getByText("Fin du diagnostic de la tâche.", { exact: true }).last();
    await lastLine.scrollIntoViewIfNeeded();
    await expect(lastLine).toBeInViewport({ ratio: 1 });
    await expect(input).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const settings = page.getByRole("region", { name: "Réglages du message" });
    expect(await settings.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  }
});

test("model selection and audit action are structured task fields", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/message", route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { task_id: demoId } }); });
  await page.goto("/"); await selectDemoProject(page);
  await page.getByRole("combobox", { name: "Modèle de la tâche" }).selectOption({ label: "code-test · fixture" });
  await page.getByRole("textbox", { name: "Message à l’agent" }).fill("/audit inspecter les dépendances");
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect.poll(() => sent).toMatchObject({ studio_model: { provider: "fixture", model: "code-test" }, studio_action: "audit", message: "inspecter les dépendances" });
});

test("slash palette supports keyboard selection and rejects unknown commands", async ({ page }) => {
  let sends = 0;
  await page.route("**/api/message", route => { sends++; return route.fulfill({ json: { task_id: demoId } }); });
  await page.goto("/"); await selectDemoProject(page);
  const input = page.getByRole("textbox", { name: "Message à l’agent" });
  await input.fill("/deb"); await input.press("ArrowDown"); await page.keyboard.press("Enter");
  await expect(input).toHaveValue("/debug ");
  await expect(input).toBeFocused();
  await input.fill("/inconnu une demande"); await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Commande \/inconnu inconnue/ })).toBeVisible(); expect(sends).toBe(0);
  await expect(input).toHaveValue("/inconnu une demande");
});

test("goal configuration sends mechanical criteria and bounded budgets", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/message", route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { task_id: demoId } }); });
  await page.goto("/"); await selectDemoProject(page);
  await page.getByRole("textbox", { name: "Message à l’agent" }).fill("/goal Faire passer les tests");
  await page.getByLabel("Type de vérification de l’objectif").selectOption("command_ok");
  await page.getByLabel("Commande de vérification de l’objectif").fill('["npm","test"]');
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect.poll(() => sent).toMatchObject({ studio_action: "goal", studio_goal: { objective: "Faire passer les tests", max_cycles: 4, max_seconds: 600, max_tokens: 50000, criteria: { criteria: [{ kind: "command_ok", argv: ["npm", "test"] }] } } });
});

for (const action of ["debug", "test"]) {
  test(`${action} workflow is sent as a structured action`, async ({ page }) => {
    let sent: Record<string, unknown> | null = null;
    await page.route("**/api/message", route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { task_id: demoId } }); });
    await page.goto("/"); await selectDemoProject(page);
    await page.getByRole("textbox", { name: "Message à l’agent" }).fill(`/${action} Vérifier le jeu`);
    await page.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect.poll(() => sent).toMatchObject({ studio_action: action, message: "Vérifier le jeu" });
  });
}

test("goal controls pause resume and cancel the same task on mobile", async ({ page }) => {
  let state = "active";
  const controls: string[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(`**/api/tasks/${demoId}/goal`, route => route.fulfill({ json: {
    objective: "Créer le jeu", state, cycles: 1, max_cycles: 4, max_seconds: 600, elapsed_ms: 1000, tokens_used: 120, max_tokens: 50000,
  } }));
  for (const action of ["pause", "resume", "cancel"]) {
    await page.route(`**/api/tasks/${demoId}/${action}`, route => {
      controls.push(action); state = action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled";
      return route.fulfill({ json: { ok: true } });
    });
  }
  await page.goto("/"); await selectDemoProject(page);
  await page.getByRole("navigation", { name: "Navigation mobile" }).getByRole("button", { name: "Discussion", exact: true }).click();
  await page.getByRole("textbox", { name: "Message à l’agent" }).fill("Créer le jeu");
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  const goal = page.getByRole("region", { name: "Objectif en cours" });
  await goal.getByRole("button", { name: "Mettre en pause", exact: true }).click();
  await goal.getByRole("button", { name: "Reprendre l’objectif", exact: true }).click();
  await goal.getByRole("button", { name: "Arrêter l’objectif", exact: true }).click();
  await expect(goal).toContainText("Arrêté");
  expect(controls).toEqual(["pause", "resume", "cancel"]);
});

test("branch merge requires comparison and an explicit confirmation", async ({ page }) => {
  let merged = false;
  await page.route("**/git/branches", route => route.fulfill({ json: { current_branch: "main", branches: [
    { name: "main", current: true, upstream: null, ahead: 0, behind: 0, last_commit_subject: "Initial" },
    { name: "feature", current: false, upstream: "origin/feature", ahead: 1, behind: 0, last_commit_subject: "Game" },
  ] } }));
  await page.route("**/git/compare**", route => route.fulfill({ json: { base: "main", target: "feature", files_changed: 2, insertions: 10, deletions: 1, ahead: 1, behind: 0, commits: [] } }));
  await page.route("**/git/merge", route => { merged = true; return route.fulfill({ json: { ok: true } }); });
  await page.goto("/"); await selectDemoProject(page); await openSection(page, /Développement/i, /^Branches$/);
  await expect(page.getByText("Aucun suivi distant configuré")).toBeVisible();
  const merge = page.getByRole("button", { name: "Fusionner après examen", exact: true }); await expect(merge).toBeDisabled();
  await page.getByRole("button", { name: "Comparer", exact: true }).click(); await expect(merge).toBeEnabled();
  page.once("dialog", dialog => dialog.dismiss()); await merge.click(); expect(merged).toBe(false);
  page.once("dialog", dialog => dialog.accept()); await merge.click(); await expect.poll(() => merged).toBe(true);
  await page.screenshot({ path: "docs/screenshots/tickets-branches-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Navigation principale", exact: true })).not.toBeVisible();
  await expect.poll(async () => (await page.locator(".center").boundingBox())?.width).toBeGreaterThan(350);
  await page.screenshot({ path: "docs/screenshots/tickets-branches-mobile.png", fullPage: true });
});


test("failed task recovery prepares a draft without replaying effects", async ({ page }) => {
  let sends=0;
  await page.route("**/api/message",route=>{sends++;return route.fulfill({json:{task_id:demoId}});});
  await page.route(`**/api/tasks/${demoId}`,route=>route.fulfill({json:{task_id:demoId,status:"failed",failure_detail:"Aucun signal reçu après 180 secondes; cause non confirmée.",progress:[],outcome:{schema_version:1,termination_reason:"inactivity_timeout",result:"partial",acceptance_verified:false,verification:[]}}}));
  await page.goto("/");await selectDemoProject(page);
  await page.getByRole("textbox",{name:"Message à l’agent"}).fill("Modifier les fichiers du jeu");
  await page.getByRole("button",{name:"Envoyer",exact:true}).click();
  await expect(page.getByText("Résultat partiel · Aucun signal de progression reçu").first()).toBeVisible();
  await page.locator(".chat-task-status > summary").click();
  await page.getByRole("button",{name:"Préparer une nouvelle demande",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Message à l’agent"})).toHaveValue("Modifier les fichiers du jeu");
  expect(sends).toBe(1);
  await expect(page.getByText(/Une nouvelle soumission crée une autre tâche/)).toBeVisible();
});
