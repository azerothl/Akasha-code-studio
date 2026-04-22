export type DesignSeverity = "error" | "warning" | "info";

export type DesignDiagnostic = {
  severity: DesignSeverity;
  path: string;
  message: string;
};

export type DesignTokenState = {
  name?: string;
  colors: Record<string, string>;
  typographyKeys: string[];
  spacing: Record<string, string>;
  rounded: Record<string, string>;
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
    spacing: {},
    rounded: {},
  };
  let section = "";
  let sectionIndent = 0;
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
        if (key === "name") tokens.name = stripQuotes(value);
      }
      continue;
    }

    if (!section || indent <= sectionIndent || !trimmed.includes(":")) continue;
    const [k, ...rest] = trimmed.split(":");
    const key = k.trim();
    const value = stripQuotes(rest.join(":").trim());

    if (section === "colors" && value) tokens.colors[key] = value;
    if (section === "spacing" && value) tokens.spacing[key] = value;
    if (section === "rounded" && value) tokens.rounded[key] = value;
    if (section === "typography" && key && indent === 2) tokens.typographyKeys.push(key);
  }
  return tokens;
}

export function parseDesignDoc(raw: string): DesignParseResult {
  const content = raw.trim();
  if (!content) {
    return {
      raw,
      frontMatter: null,
      body: "",
      tokens: { colors: {}, typographyKeys: [], spacing: {}, rounded: {} },
      diagnostics: [{ severity: "info", path: "root", message: "DESIGN.md est vide." }],
      status: "absent",
    };
  }

  const { fm, body } = parseFrontMatter(raw);
  const diagnostics: DesignDiagnostic[] = [];
  const tokens = fm ? parseSimpleYamlMap(fm) : { colors: {}, typographyKeys: [], spacing: {}, rounded: {} };
  if (!fm) diagnostics.push({ severity: "error", path: "frontmatter", message: "Front matter YAML manquant." });
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

