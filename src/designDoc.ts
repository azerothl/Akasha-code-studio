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
      } else if (indent >= 4 && currentTypographyToken) {
        tokens.typographyShape[currentTypographyToken] = { hasObject: true };
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
      tokens: { colors: {}, typographyKeys: [], typographyShape: {}, spacing: {}, rounded: {}, components: {} },
      diagnostics: [{ severity: "info", path: "root", message: "DESIGN.md est vide." }],
      status: "absent",
    };
  }

  const { fm, body } = parseFrontMatter(raw);
  const diagnostics: DesignDiagnostic[] = [];
  const tokens = fm
    ? parseSimpleYamlMap(fm)
    : { colors: {}, typographyKeys: [], typographyShape: {}, spacing: {}, rounded: {}, components: {} };
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

