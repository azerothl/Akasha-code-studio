/** Visual review fixtures, API simulated. Run with the Vite server on port 5178. */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { installApi } from "./capture-readme-screenshots.mjs";

const browser = await chromium.launch();
const out = "docs/screenshots";
await mkdir(out, { recursive: true });
const projectId = "00000000-0000-4000-8000-000000000001";
const captures = [];
async function openPage(width, height, populated = true) {
  const page = await browser.newPage({ viewport: { width, height } });
  await installApi(page);
  if (!populated) await page.route("**/api/studio/projects", route => route.fulfill({ json: { projects: [] } }));
  await page.addInitScript(({ projectId, populated }) => {
    localStorage.setItem("akasha-studio-sidebar-open", "1");
    localStorage.setItem("studio.uiDensity", "normal");
    if (populated) localStorage.setItem(`akasha-code-studio-chat-v2:${projectId}`, JSON.stringify([
      { role: "user", text: "Simplifie l’en-tête et rends le statut de connexion plus discret." },
      { role: "assistant", text: "L’en-tête affiche maintenant le projet et un indicateur de connexion. Les réglages techniques sont regroupés dans **Outils du projet**.\n\nLa navigation mobile donne accès à la discussion, aux fichiers et à l’aperçu." },
    ]));
  }, { projectId, populated });
  await page.goto("http://127.0.0.1:5178");
  await page.locator(".chat-welcome, .bubble").first().waitFor();
  await page.locator(".workspace-header").waitFor();
  await page.getByRole("img", { name: "Daemon : En ligne" }).waitFor();
  if (populated) await page.locator(".workspace-project").filter({ hasText: "Atelier" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function capture(page, name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  captures.push({ name, geometry: await page.evaluate(() => {
    const rect = selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, header: rect(".workspace-header"), composer: rect(".chat-form"), navigation: rect(".mobile-workspace-nav") };
  }) });
}
try {
  const desktop = await openPage(1440, 960);
  await capture(desktop, "workspace-desktop");
  const mobile = await openPage(390, 844);
  await capture(mobile, "workspace-mobile");
  await mobile.getByRole("button", { name: "Outils du projet", exact: true }).click();
  await mobile.getByTestId("studio-project-settings-menu").click();
  await capture(mobile, "workspace-mobile-tools");
  await mobile.getByRole("button", { name: "Fermer les outils" }).click();
  await mobile.getByRole("navigation", { name: "Navigation mobile" }).getByRole("button", { name: "Fichiers" }).click();
  await mobile.getByRole("button", { name: "App.tsx", exact: true }).click();
  await mobile.locator(".monaco-editor").first().waitFor({ timeout: 30000 });
  await capture(mobile, "workspace-mobile-files");
  const empty = await openPage(390, 844, false);
  await capture(empty, "workspace-mobile-welcome");
  console.log(JSON.stringify(captures, null, 2));
} finally { await browser.close(); }
