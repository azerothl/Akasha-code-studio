export type DesignSeverity = "error" | "warning" | "info";

export type DesignDiagnostic = {
  severity: DesignSeverity;
  path: string;
  message: string;
};

export type DesignTokenState = {
  version?: string;
  name?: string;
  description?: string;
  colors: Record<string, string>;
  typographyKeys: string[];
  typographyShape: Record<string, { hasObject: boolean }>;
  /** Champs feuille par rôle typo (fontSize, fontWeight, …) pour preview UI. */
  typographyDetails: Record<string, Record<string, string>>;
  spacing: Record<string, string>;
  rounded: Record<string, string>;
  components: Record<string, string[]>;
};

export type DesignParseResult = {
  raw: string;
  frontMatter: string | null;
  body: string;
  tokens: DesignTokenState;
  diagnostics: DesignDiagnostic[];
  status: "absent" | "error" | "warning" | "valid";
};

const HEX_COLOR_RE = /^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
const DIMENSION_RE = /^-?\d+(\.\d+)?(px|em|rem)$/;
const TOKEN_REF_RE = /^\{[A-Za-z0-9_.-]+\}$/;
const CANONICAL_SECTIONS = [
  "overview",
  "colors",
  "typography",
  "layout",
  "elevation & depth",
  "shapes",
  "components",
  "do's and don'ts",
] as const;
const SECTION_ALIAS_TO_CANONICAL: Record<string, (typeof CANONICAL_SECTIONS)[number]> = {
  "overview": "overview",
  "brand & style": "overview",
  "colors": "colors",
  "typography": "typography",
  "layout": "layout",
  "layout & spacing": "layout",
  "elevation & depth": "elevation & depth",
  "elevation": "elevation & depth",
  "shapes": "shapes",
  "components": "components",
  "do's and don'ts": "do's and don'ts",
};
const VALID_COMPONENT_PROPERTIES = new Set([
  "backgroundColor",
  "textColor",
  "typography",
  "rounded",
  "padding",
  "size",
  "height",
  "width",
]);

/**
 * Compact English hint for `studio_design_hint` on DESIGN.md regenerate tasks.
 * Daemon truncates at 4000 chars (`MAX_DESIGN_HINT_CHARS`); keep this well under that budget.
 */
export const DESIGN_DOC_AGENT_STUDIO_HINT_COMPACT_EN = [
  "Code Studio DESIGN.md — structure contract:",
  "YAML front matter between --- … --- then markdown body (no # file title).",
  "Top-level YAML keys only: optional version: alpha; name; optional description; colors; typography; rounded; spacing; components.",
  "No theme:/semver design schema. Put narrative in markdown, not parallel YAML schemes.",
  "colors: flat token -> quoted #hex. typography: nested tokens (fontFamily, fontSize, fontWeight, lineHeight; optional letterSpacing, textTransform).",
  "rounded/spacing: px|em|rem, numbers, or {token.path} refs (no spaces inside braces). rounded keys may include DEFAULT.",
  "components: nested maps; props: backgroundColor (hex|rgba|transparent|ref), textColor, typography, rounded, padding, size, height, width. Sibling keys for states (e.g. *-hover) are OK.",
  "## order (each slot once; English prose): (1) ## Brand & Style OR ## Overview → (2) ## Colors → (3) ## Typography → (4) ## Layout & Spacing OR ## Layout → (5) ## Elevation & depth → (6) ## Shapes → (7) ## Components (### subsections allowed) → (8) optional ## Do's and don'ts. Extra ## only after slot (8) if used.",
  "Wrong headings for slots: e.g. ## Color Palette, ## Design System (not recognized). File must be English-only; no task recap or npm instructions inside DESIGN.md.",
].join(" ");

/**
 * English block appended to Code Studio “regenerate DESIGN.md” tasks so the model
 * emits a file that matches `parseDesignDoc` / UI expectations (not a generic article).
 */
export const DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN = `
### Mandatory file shape (Code Studio DESIGN.md)

The deliverable is a single file \`DESIGN.md\` with **YAML front matter** between the first pair of \`---\` lines, **one blank line after the closing \`---\`**, then the **markdown body**. Nothing else (no task recap, no npm commands, no “I created the file” paragraph, no non-English text anywhere in the file).

**YAML — top-level keys (reference-quality shape)**

Use this structure; **do not** add parallel schemes such as \`theme:\`, semver \`version: 1.0.0\` as a “design schema”, or moving the palette **only** into markdown/CSS vars instead of the \`colors:\` map.

- \`version: alpha\` — **optional**; if you include \`version\`, prefer the literal \`alpha\` for Code Studio tooling (not semver here).
- \`name: "…"\` or \`name: …\` — short app/product name (English).
- \`description: "…"\` — optional one-line English summary.
- \`colors:\` — flat map \`token-name: "#RRGGBB"\` (quoted hex). Values must reflect styles **found in the repo** when recreating from code; do not invent colors.
- \`typography:\` — each role (e.g. \`display-lg:\`, \`body-md:\`) is a **nested YAML object** with at least \`fontFamily\`, \`fontSize\`, \`fontWeight\`, \`lineHeight\` (optional: \`letterSpacing\`, \`textTransform\`, …). \`fontFamily\` may be a bare token (\`Inter\`) or quoted. \`fontWeight\` may be quoted when numeric. Do **not** replace this block with bullet-list typography.
- \`rounded:\` — map token → \`NNpx\` / \`Nem\` / \`Nrem\` / \`9999px\`-style radii, or a token reference \`{rounded.sm}\` (no spaces inside \`{…}\`). Keys may include \`DEFAULT\` where that matches the project.
- \`spacing:\` — map token → bare number, \`NNpx\`/\`Nrem\`, or \`{token.path}\`.
- \`components:\` — each \`component-name:\` is a nested map. Allowed property keys only: **backgroundColor**, **textColor**, **typography**, **rounded**, **padding**, **size**, **height**, **width**. Values may be hex, \`rgba(...)\`, \`transparent\`, dimensions, shorthand like \`0 24px\`, or \`{colors.*}\` / \`{typography.*}\` / \`{spacing.*}\` / \`{rounded.*}\`. Separate component entries for states (e.g. \`*-hover\`) are encouraged when they differ.

**Markdown body — \`##\` narrative sections, fixed logical order**

- Do **not** use an \`# …\` top-level document title; identity lives in YAML \`name\` (and optional \`description\`).
- Use **level-2** headings \`## …\` for the main narrative, in this **logical** order (each canonical **slot** appears once). **Accepted titles** (Code Studio maps aliases to the same slot):
  1. **Overview slot:** \`## Brand & Style\` **or** \`## Overview\`
  2. \`## Colors\`
  3. \`## Typography\`
  4. **Layout slot:** \`## Layout & Spacing\` **or** \`## Layout\`
  5. \`## Elevation & depth\` (or \`## Elevation\` — maps to the same slot)
  6. \`## Shapes\`
  7. \`## Components\` — you may use \`### …\` sub-headings inside this section for groups (Glass, Buttons, …).
  8. **Optional:** \`## Do's and don'ts\` — include when you have explicit guardrails; omit if nothing material (do not invent filler).
- **Do not** use unrecognized substitutes for required slots, e.g. \`## Color Palette\`, \`## Design System\`, or a combined heading that is **not** one of the accepted titles above for that slot.
- Optional extra \`## …\` sections are allowed **only after** the last used slot from the list above (including after \`## Do's and don'ts\` when present) so canonical order stays valid.
- Tables and bullet lists in the body are for explanation only; they **must not** replace the YAML token maps.

**Forbidden inside \`DESIGN.md\`**

- Any language other than English in headings or body.
- Chat-style closing (“here is what I did…”), runbooks, or shell/npm instructions.
- Duplicate \`##\` headings that map to the **same** canonical slot (e.g. both \`## Overview\` and \`## Brand & Style\`).
- Styles, colors, or fonts not evidenced in project source/stylesheets/config when recreating from the repo.
`.trim();

function parseFrontMatter(raw: string): { fm: string | null; body: string } {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!match) return { fm: null, body: raw };
  return { fm: match[1], body: match[2] ?? "" };
}

function stripQuotes(v: string): string {
  const trimmed = v.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSimpleYamlMap(frontMatter: string): DesignTokenState {
  const lines = frontMatter.split(/\r?\n/);
  const tokens: DesignTokenState = {
    colors: {},
    typographyKeys: [],
    typographyShape: {},
    typographyDetails: {},
    spacing: {},
    rounded: {},
    components: {},
  };
  let section = "";
  let sectionIndent = 0;
  let currentTypographyToken = "";
  let currentComponent = "";
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0 && trimmed.includes(":")) {
      const [k, ...rest] = trimmed.split(":");
      const key = k.trim();
      const value = rest.join(":").trim();
      section = key;
      sectionIndent = indent;
      if (value) {
        if (key === "version") tokens.version = stripQuotes(value);
        if (key === "name") tokens.name = stripQuotes(value);
        if (key === "description") tokens.description = stripQuotes(value);
      }
      currentTypographyToken = "";
      currentComponent = "";
      continue;
    }

    if (!section || indent <= sectionIndent || !trimmed.includes(":")) continue;
    const [k, ...rest] = trimmed.split(":");
    const key = k.trim();
    const value = stripQuotes(rest.join(":").trim());

    if (section === "colors" && value) tokens.colors[key] = value;
    if (section === "spacing" && value) tokens.spacing[key] = value;
    if (section === "rounded" && value) tokens.rounded[key] = value;
    if (section === "typography" && key) {
      if (indent === 2) {
        currentTypographyToken = key;
        if (!tokens.typographyKeys.includes(key)) tokens.typographyKeys.push(key);
        const hasObject = value === "{" || value === "{}" || value === "" || value.startsWith("{");
        tokens.typographyShape[key] = { hasObject };
        tokens.typographyDetails[key] ??= {};
      } else if (indent >= 4 && currentTypographyToken && value) {
        tokens.typographyShape[currentTypographyToken] = { hasObject: true };
        tokens.typographyDetails[currentTypographyToken] ??= {};
        tokens.typographyDetails[currentTypographyToken][key] = value;
      }
    }
    if (section === "components" && key) {
      if (indent === 2) {
        currentComponent = key;
        if (!tokens.components[currentComponent]) tokens.components[currentComponent] = [];
      } else if (indent >= 4 && currentComponent) {
        tokens.components[currentComponent] ??= [];
        tokens.components[currentComponent].push(key);
      }
    }
  }
  return tokens;
}

function parseMarkdownH2Sections(body: string): { rawTitle: string; canonical: string | null; index: number }[] {
  const sections: { rawTitle: string; canonical: string | null; index: number }[] = [];
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^##\s+(.+)\s*$/);
    if (!m) continue;
    const rawTitle = m[1].trim();
    const key = rawTitle.toLowerCase();
    sections.push({
      rawTitle,
      canonical: SECTION_ALIAS_TO_CANONICAL[key] ?? null,
      index: i,
    });
  }
  return sections;
}

function normalizeTokenRefSpacing(raw: string): string {
  return raw.replace(/\{\s*([A-Za-z0-9_.-]+)\s*\}/g, "{$1}");
}

function normalizeSectionOrder(body: string): string {
  const lines = body.split(/\r?\n/);
  const markers = parseMarkdownH2Sections(body);
  if (markers.length === 0) return body.trim();
  const blocks = markers.map((m, idx) => {
    const start = m.index;
    const end = idx + 1 < markers.length ? markers[idx + 1].index : lines.length;
    return {
      ...m,
      content: lines.slice(start, end).join("\n").trimEnd(),
      originalOrder: idx,
    };
  });
  const known = blocks.filter((b) => b.canonical != null);
  const unknown = blocks.filter((b) => b.canonical == null);
  known.sort((a, b) => {
    const ai = CANONICAL_SECTIONS.indexOf(a.canonical as (typeof CANONICAL_SECTIONS)[number]);
    const bi = CANONICAL_SECTIONS.indexOf(b.canonical as (typeof CANONICAL_SECTIONS)[number]);
    return ai - bi || a.originalOrder - b.originalOrder;
  });
  const out = [...known, ...unknown].map((b) => b.content).filter(Boolean);
  return out.join("\n\n").trim();
}

export function parseDesignDoc(raw: string): DesignParseResult {
  const content = raw.trim();
  if (!content) {
    return {
      raw,
      frontMatter: null,
      body: "",
      tokens: {
        colors: {},
        typographyKeys: [],
        typographyShape: {},
        typographyDetails: {},
        spacing: {},
        rounded: {},
        components: {},
      },
      diagnostics: [{ severity: "info", path: "root", message: "DESIGN.md est vide." }],
      status: "absent",
    };
  }

  const { fm, body } = parseFrontMatter(raw);
  const diagnostics: DesignDiagnostic[] = [];
  const tokens = fm
    ? parseSimpleYamlMap(fm)
    : {
        colors: {},
        typographyKeys: [],
        typographyShape: {},
        typographyDetails: {},
        spacing: {},
        rounded: {},
        components: {},
      };
  if (!fm) diagnostics.push({ severity: "error", path: "frontmatter", message: "Front matter YAML manquant." });
  if (tokens.version && tokens.version !== "alpha") {
    diagnostics.push({
      severity: "info",
      path: "version",
      message: `Version déclarée "${tokens.version}" (la version courante est "alpha").`,
    });
  }
  if (!tokens.name) diagnostics.push({ severity: "warning", path: "name", message: "Token `name` absent." });
  if (Object.keys(tokens.colors).length === 0) {
    diagnostics.push({ severity: "warning", path: "colors", message: "Aucun token `colors` détecté." });
  }
  if (tokens.typographyKeys.length === 0) {
    diagnostics.push({ severity: "warning", path: "typography", message: "Aucun token `typography` détecté." });
  }
  if (tokens.colors.primary == null && Object.keys(tokens.colors).length > 0) {
    diagnostics.push({ severity: "warning", path: "colors.primary", message: "Couleur `primary` absente." });
  }
  for (const [name, value] of Object.entries(tokens.colors)) {
    if (!HEX_COLOR_RE.test(value)) {
      diagnostics.push({
        severity: "warning",
        path: `colors.${name}`,
        message: `Couleur invalide (${value}), format hex attendu.`,
      });
    }
  }
  for (const [name, shape] of Object.entries(tokens.typographyShape)) {
    if (!shape.hasObject) {
      diagnostics.push({
        severity: "warning",
        path: `typography.${name}`,
        message: "Typography token devrait être un objet (fontFamily, fontSize, fontWeight, lineHeight, ...).",
      });
    }
  }
  for (const [name, value] of Object.entries(tokens.rounded)) {
    if (!(DIMENSION_RE.test(value) || TOKEN_REF_RE.test(value))) {
      diagnostics.push({
        severity: "warning",
        path: `rounded.${name}`,
        message: "Rounded value devrait être une dimension (`px|em|rem`) ou une référence `{path.token}`.",
      });
    }
  }
  for (const [name, value] of Object.entries(tokens.spacing)) {
    const isNumber = /^-?\d+(\.\d+)?$/.test(value);
    if (!(isNumber || DIMENSION_RE.test(value) || TOKEN_REF_RE.test(value))) {
      diagnostics.push({
        severity: "warning",
        path: `spacing.${name}`,
        message: "Spacing value devrait être un nombre, une dimension (`px|em|rem`) ou une référence.",
      });
    }
  }
  for (const [componentName, props] of Object.entries(tokens.components)) {
    for (const prop of props) {
      if (!VALID_COMPONENT_PROPERTIES.has(prop)) {
        diagnostics.push({
          severity: "warning",
          path: `components.${componentName}.${prop}`,
          message: "Propriété composant inconnue (préservée mais hors liste de référence).",
        });
      }
    }
  }

  const sections = parseMarkdownH2Sections(body);
  const canonicalSeen: Record<string, number> = {};
  for (const s of sections) {
    if (!s.canonical) continue;
    canonicalSeen[s.canonical] = (canonicalSeen[s.canonical] ?? 0) + 1;
  }
  for (const [name, count] of Object.entries(canonicalSeen)) {
    if (count > 1) {
      diagnostics.push({
        severity: "error",
        path: `body.sections.${name}`,
        message: `Section dupliquée détectée (${count}).`,
      });
    }
  }
  const order = sections
    .filter((s) => s.canonical)
    .map((s) => CANONICAL_SECTIONS.indexOf(s.canonical as (typeof CANONICAL_SECTIONS)[number]));
  for (let i = 1; i < order.length; i += 1) {
    if (order[i] < order[i - 1]) {
      diagnostics.push({
        severity: "warning",
        path: "body.section-order",
        message: "Les sections connues ne respectent pas l’ordre canonique de la spec.",
      });
      break;
    }
  }
  if (!/^##\s+/m.test(body)) {
    diagnostics.push({
      severity: "info",
      path: "body.sections",
      message: "Aucune section markdown `##` détectée dans la partie narrative.",
    });
  }

  const hasError = diagnostics.some((d) => d.severity === "error");
  const hasWarn = diagnostics.some((d) => d.severity === "warning");
  const status: DesignParseResult["status"] = hasError ? "error" : hasWarn ? "warning" : "valid";
  return { raw, frontMatter: fm, body, tokens, diagnostics, status };
}

export function buildDesignPolicyHint(parsed: DesignParseResult): string {
  if (parsed.status === "absent") return "";
  const colors = Object.keys(parsed.tokens.colors).slice(0, 8);
  const typo = parsed.tokens.typographyKeys.slice(0, 6);
  const parts: string[] = [];
  if (parsed.tokens.name) parts.push(`design-system: ${parsed.tokens.name}`);
  if (colors.length) parts.push(`colors: ${colors.join(", ")}`);
  if (typo.length) parts.push(`typography: ${typo.join(", ")}`);
  return parts.join(" | ");
}

export function designTokensToCss(parsed: DesignParseResult): string {
  const lines: string[] = [":root {"];
  for (const [k, v] of Object.entries(parsed.tokens.colors)) {
    lines.push(`  --design-color-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(parsed.tokens.spacing)) {
    lines.push(`  --design-spacing-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(parsed.tokens.rounded)) {
    lines.push(`  --design-rounded-${k}: ${v};`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function designTokensToJson(parsed: DesignParseResult): string {
  return `${JSON.stringify(
    {
      name: parsed.tokens.name ?? null,
      colors: parsed.tokens.colors,
      typography: parsed.tokens.typographyKeys,
      spacing: parsed.tokens.spacing,
      rounded: parsed.tokens.rounded,
    },
    null,
    2,
  )}\n`;
}

export function normalizeDesignDoc(raw: string): string {
  const content = raw.trim();
  if (!content) return raw;
  const { fm, body } = parseFrontMatter(raw);
  const normalizedBody = normalizeSectionOrder(normalizeTokenRefSpacing(body ?? ""));
  if (!fm) {
    return normalizeTokenRefSpacing(raw).trimEnd() + "\n";
  }
  const normalizedFm = normalizeTokenRefSpacing(fm).trim();
  const withBody = normalizedBody ? `\n\n${normalizedBody}\n` : "\n";
  return `---\n${normalizedFm}\n---${withBody}`;
}

