/** Valeur du `<select>` pour une stack entièrement libre. */
export const STACK_PRESET_CUSTOM = "custom";

/** Aucun modèle : rien n’est envoyé au serveur tant que l’utilisateur n’a pas choisi. */
export const STACK_PRESET_NONE = "";

export type StackAddonCategoryId = "frontend" | "backend" | "design" | "data" | "quality";

export type StackPresetRow = { id: string; label: string; text: string };

export const BASE_STACK_PRESETS: StackPresetRow[] = [
  {
    id: "vite_react_ts",
    label: "Vite · React · TypeScript",
    text: `Frontend : Vite 5+, React 18+, TypeScript (strict), ESLint + Prettier.
Styles : CSS cohérent avec la maquette ou consignes utilisateur (pas de framework CSS imposé sauf demande).
Tests : Vitest pour la logique non triviale si pertinent.`,
  },
  {
    id: "python_uv_streamlit",
    label: "Python · uv · Streamlit",
    text: `Application : Python 3.11+, gestion de paquets avec uv, interface Streamlit.
Structure : modules Python clairs ; pas de sur-ingénierie ; README avec commandes uv run.
Données : fichiers locaux ou cache léger sauf demande contraire.`,
  },
  {
    id: "go",
    label: "Go",
    text: `Backend ou CLI : Go 1.22+, modules Go standard, erreurs explicites, context pour I/O.
API : JSON si exposition HTTP ; tests table-driven pour le cœur métier.`,
  },
  {
    id: "rust",
    label: "Rust (service / CLI)",
    text: `Rust stable, édition récente ; clippy ; gestion d’erreur avec Result / anyhow ou thiserror selon le contexte.
Binaire ou lib : structure idiomatique, tests unitaires ciblés.`,
  },
  {
    id: "node_express",
    label: "Node.js · Express",
    text: `Backend : Node.js LTS, Express, validation (zod ou équivalent), réponses JSON homogènes.
Persistance : SQLite légère (better-sqlite3 ou équivalent) sauf demande contraire de l’utilisateur.`,
  },
  {
    id: "next_app_router",
    label: "Next.js (App Router)",
    text: `Full-stack web : Next.js (App Router), React, TypeScript.
Données : à préciser côté utilisateur (Route Handlers + ORM léger de préférence).`,
  },
  {
    id: "fastapi",
    label: "Python · FastAPI",
    text: `Backend : Python 3.11+, FastAPI, Pydantic v2, Uvicorn.
API REST typée ; erreurs HTTP et corps JSON explicites.`,
  },
  {
    id: "tauri_rust",
    label: "Tauri · Rust + UI web",
    text: `Bureau : Tauri 2, UI web (React + TypeScript si non spécifié autrement), logique sensible dans src-tauri (Rust).`,
  },
  {
    id: "sveltekit",
    label: "SvelteKit",
    text: `Web : SvelteKit, Svelte 5, TypeScript ; routes et loaders idiomatiques ; adapter-node ou statique selon le besoin.`,
  },
  {
    id: STACK_PRESET_CUSTOM,
    label: "Personnalisé (texte libre)",
    text: "",
  },
];

export const STACK_ADDON_GROUPS: {
  id: StackAddonCategoryId;
  title: string;
  options: { id: string; label: string }[];
}[] = [
  {
    id: "frontend",
    title: "Frontend",
    options: [
      { id: "react", label: "React" },
      { id: "vue", label: "Vue 3" },
      { id: "svelte", label: "Svelte / SvelteKit" },
      { id: "vite", label: "Vite" },
      { id: "next", label: "Next.js" },
      { id: "htmx", label: "HTMX + templates" },
      { id: "solid", label: "SolidJS" },
    ],
  },
  {
    id: "backend",
    title: "Backend",
    options: [
      { id: "node_express", label: "Node · Express" },
      { id: "fastapi", label: "FastAPI" },
      { id: "go_net", label: "Go (net/http)" },
      { id: "axum", label: "Rust · Axum" },
      { id: "actix", label: "Rust · Actix" },
      { id: "django", label: "Django" },
      { id: "rails", label: "Ruby on Rails" },
    ],
  },
  {
    id: "design",
    title: "Design / UI",
    options: [
      { id: "tailwind", label: "Tailwind CSS" },
      { id: "shadcn", label: "shadcn/ui" },
      { id: "mui", label: "Material UI" },
      { id: "css_modules", label: "CSS modules" },
      { id: "vanilla_css", label: "CSS classique" },
      { id: "radix", label: "Radix (primitives)" },
    ],
  },
  {
    id: "data",
    title: "Données & cache",
    options: [
      { id: "sqlite", label: "SQLite" },
      { id: "postgres", label: "PostgreSQL" },
      { id: "mysql", label: "MySQL / MariaDB" },
      { id: "prisma", label: "Prisma" },
      { id: "drizzle", label: "Drizzle ORM" },
      { id: "redis", label: "Redis" },
      { id: "mongo", label: "MongoDB" },
    ],
  },
  {
    id: "quality",
    title: "Qualité & tests",
    options: [
      { id: "eslint", label: "ESLint" },
      { id: "prettier", label: "Prettier" },
      { id: "vitest", label: "Vitest" },
      { id: "playwright", label: "Playwright" },
      { id: "pytest", label: "pytest" },
      { id: "go_test", label: "go test" },
      { id: "rust_clippy", label: "clippy + rustfmt" },
    ],
  },
];

export function emptyStackAddons(): Record<StackAddonCategoryId, string[]> {
  return { frontend: [], backend: [], design: [], data: [], quality: [] };
}

export function composeStackString(
  presetId: string,
  customText: string,
  addons: Record<StackAddonCategoryId, string[]>,
): string {
  if (presetId === STACK_PRESET_NONE) {
    return "";
  }
  let base = "";
  if (presetId === STACK_PRESET_CUSTOM) {
    base = customText.trim();
  } else {
    const preset = BASE_STACK_PRESETS.find((p) => p.id === presetId);
    base = (preset?.text ?? "").trim();
  }
  const lines: string[] = [];
  for (const group of STACK_ADDON_GROUPS) {
    const ids = addons[group.id] ?? [];
    if (ids.length === 0) continue;
    const labels = ids
      .map((oid) => group.options.find((o) => o.id === oid)?.label ?? oid)
      .filter(Boolean);
    if (labels.length > 0) {
      lines.push(`${group.title} : ${labels.join(", ")}`);
    }
  }
  if (lines.length === 0) {
    return base;
  }
  const appendix = `— Précisions choisies —\n${lines.join("\n")}`;
  return base ? `${base}\n\n${appendix}` : appendix;
}
