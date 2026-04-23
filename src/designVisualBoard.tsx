import type { CSSProperties, ReactNode } from "react";
import type { DesignParseResult, DesignTokenState } from "./designDoc";

type Props = { parsed: DesignParseResult };

type NativeKind =
  | "button"
  | "radio"
  | "checkbox"
  | "textarea"
  | "select"
  | "input"
  | "label"
  | "row"
  | "cell"
  | "column";

const BARE_NUMBER_RE = /^-?\d+(\.\d+)?$/;

function parseBracketRef(raw: string): { root: string; key: string } | null {
  const m = raw.trim().match(/^\{\s*([^}]+?)\s*\}$/);
  if (!m) return null;
  const inner = m[1].replace(/\s+/g, "");
  const dot = inner.indexOf(".");
  if (dot < 0) return null;
  const root = inner.slice(0, dot);
  const key = inner.slice(dot + 1);
  if (!key || !["colors", "spacing", "rounded", "typography"].includes(root)) return null;
  return { root, key };
}

function normalizeSpacingCss(raw: string): string {
  const v = raw.trim();
  if (BARE_NUMBER_RE.test(v)) return `${v}px`;
  return v;
}

function resolveCssLeaf(raw: string, tokens: DesignTokenState, depth = 0): string {
  if (depth > 8) return raw.trim();
  const ref = parseBracketRef(raw);
  if (!ref) return normalizeSpacingCss(raw);
  const { root, key } = ref;
  let next: string | undefined;
  if (root === "colors") next = tokens.colors[key];
  else if (root === "spacing") next = tokens.spacing[key];
  else if (root === "rounded") next = tokens.rounded[key];
  else return raw.trim();
  if (next == null || next === "") return raw.trim();
  return resolveCssLeaf(next, tokens, depth + 1);
}

function typographyRoleFromValue(raw: string): string | null {
  const t = raw.trim();
  const ref = parseBracketRef(t);
  if (ref?.root === "typography") return ref.key;
  const parts = t.replace(/^\{|\}$/g, "").split(".");
  if (parts[0] === "typography" && parts[1]) return parts.slice(1).join(".");
  return null;
}

function typoDetailsToStyle(d: Record<string, string>): CSSProperties {
  const lh = d.lineHeight?.trim();
  let lineHeight: string | number | undefined;
  if (lh !== undefined && lh !== "") {
    lineHeight = /^-?\d+(\.\d+)?$/.test(lh) ? Number(lh) : lh;
  }
  return {
    fontFamily: d.fontFamily?.replace(/^["']|["']$/g, "") ?? undefined,
    fontSize: d.fontSize,
    fontWeight: d.fontWeight as CSSProperties["fontWeight"],
    lineHeight,
    letterSpacing: d.letterSpacing,
    textTransform: d.textTransform as CSSProperties["textTransform"],
  };
}

function buildComponentPreviewStyle(
  props: Record<string, string>,
  tokens: DesignTokenState,
): CSSProperties {
  const s: CSSProperties = {};
  if (props.backgroundColor) s.backgroundColor = resolveCssLeaf(props.backgroundColor, tokens);
  if (props.textColor) s.color = resolveCssLeaf(props.textColor, tokens);
  if (props.rounded) s.borderRadius = resolveCssLeaf(props.rounded, tokens);
  if (props.padding) s.padding = resolveCssLeaf(props.padding, tokens);
  if (props.height) s.height = resolveCssLeaf(props.height, tokens);
  if (props.width) s.width = resolveCssLeaf(props.width, tokens);
  if (props.size) {
    const z = resolveCssLeaf(props.size, tokens);
    s.width = z;
    s.height = z;
  }
  if (props.typography) {
    const role = typographyRoleFromValue(props.typography);
    if (role) {
      const d = tokens.typographyDetails[role] ?? {};
      Object.assign(s, typoDetailsToStyle(d));
    }
  }
  return s;
}

function inferNativeKind(componentName: string): NativeKind | null {
  const n = componentName.toLowerCase();
  const tests: [NativeKind, RegExp][] = [
    ["textarea", /\btextarea\b/],
    ["select", /\bselect\b/],
    ["checkbox", /\bcheckbox\b/],
    ["radio", /\bradio\b/],
    ["button", /\bbutton\b|\bbtn\b/],
    ["input", /\binput\b/],
    ["label", /\blabel\b/],
    ["column", /\bcolumn\b|\bcol\b/],
    ["cell", /\bcell\b/],
    ["row", /\brow\b/],
  ];
  for (const [kind, re] of tests) {
    if (re.test(n)) return kind;
  }
  return null;
}

function NativePreview({
  kind,
  style,
  name,
}: {
  kind: NativeKind;
  style: CSSProperties;
  name: string;
}): ReactNode {
  const borderFallback: CSSProperties =
    style.backgroundColor === "transparent" || style.backgroundColor === "rgba(0, 0, 0, 0)"
      ? { border: "1px dashed rgba(148, 163, 184, 0.45)" }
      : {};

  switch (kind) {
    case "button":
      return (
        <button type="button" className="design-native-preview-el" style={{ ...style, ...borderFallback }}>
          {name}
        </button>
      );
    case "radio":
      return (
        <label className="design-native-preview-row" style={{ ...style, backgroundColor: "transparent", border: "none", padding: 0 }}>
          <input
            type="radio"
            name={`design-preview-${name}`}
            defaultChecked
            style={{ accentColor: (style.color as string) || "#8b5cf6" }}
          />
          <span className="design-native-preview-after-input">Option</span>
        </label>
      );
    case "checkbox":
      return (
        <label className="design-native-preview-row" style={{ ...style, backgroundColor: "transparent", border: "none", padding: 0 }}>
          <input type="checkbox" defaultChecked style={{ accentColor: (style.color as string) || "#8b5cf6" }} />
          <span className="design-native-preview-after-input">Actif</span>
        </label>
      );
    case "input":
      return (
        <input
          type="text"
          className="design-native-preview-el"
          readOnly
          placeholder="Aperçu"
          style={{ ...style, ...borderFallback, minWidth: "8rem" }}
        />
      );
    case "textarea":
      return (
        <textarea
          className="design-native-preview-el"
          readOnly
          rows={2}
          defaultValue="Aperçu multiligne"
          style={{ ...style, ...borderFallback, minWidth: "10rem", resize: "vertical" as const }}
        />
      );
    case "select":
      return (
        <select className="design-native-preview-el" style={{ ...style, ...borderFallback }} defaultValue="a">
          <option value="a">Option A</option>
          <option value="b">Option B</option>
        </select>
      );
    case "label":
      return (
        <label className="design-native-preview-el" style={{ ...style, ...borderFallback, display: "inline-block" }}>
          Étiquette
        </label>
      );
    case "row":
      return (
        <div className="design-native-preview-row" style={{ ...style, display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <span className="design-native-mini" style={{ ...borderFallback, backgroundColor: (style.backgroundColor as string) || "rgba(139,92,246,0.25)" }} />
          <span className="design-native-mini" style={{ ...borderFallback, backgroundColor: (style.backgroundColor as string) || "rgba(139,92,246,0.35)" }} />
          <span className="design-native-mini" style={{ ...borderFallback, backgroundColor: (style.backgroundColor as string) || "rgba(139,92,246,0.45)" }} />
        </div>
      );
    case "column":
      return (
        <div className="design-native-preview-col" style={{ ...style, display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="design-native-mini-wide" style={{ ...borderFallback, backgroundColor: (style.backgroundColor as string) || "rgba(139,92,246,0.2)" }} />
          <span className="design-native-mini-wide" style={{ ...borderFallback, backgroundColor: (style.backgroundColor as string) || "rgba(139,92,246,0.3)" }} />
        </div>
      );
    case "cell":
      return (
        <div className="design-native-preview-cell" style={{ ...style, ...borderFallback, display: "flex", alignItems: "center", justifyContent: "center", minWidth: "5rem", minHeight: "3rem" }}>
          Cell
        </div>
      );
    default:
      return null;
  }
}

function DsCard({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="design-ds-card">
      <header className="design-ds-card__head">
        <span className="design-ds-card__eyebrow">{eyebrow}</span>
        <h3 className="design-ds-card__title">{title}</h3>
        {hint ? <p className="design-ds-card__hint">{hint}</p> : null}
      </header>
      <div className="design-ds-card__body">{children}</div>
    </section>
  );
}

/** Aperçu visuel des tokens DESIGN.md — cartes type panneau design (Figma / Stitch). */
export function DesignVisualBoard({ parsed }: Props) {
  const { tokens } = parsed;
  const colorEntries = Object.entries(tokens.colors);
  const typoRoles = tokens.typographyKeys;
  const spacingEntries = Object.entries(tokens.spacing);
  const roundedEntries = Object.entries(tokens.rounded);
  const componentEntries = Object.entries(tokens.components);
  const accentFill = tokens.colors.primary && /^#/.test(tokens.colors.primary) ? tokens.colors.primary : "#a78bfa";

  return (
    <div className="design-visual-board" aria-label="Aperçu visuel du design">
      {tokens.name ? (
        <DsCard eyebrow="Projet" title="Identité" hint={tokens.description}>
          <p className="design-ds-identity-name">{tokens.name}</p>
        </DsCard>
      ) : null}

      {colorEntries.length > 0 ? (
        <DsCard eyebrow="Tokens" title="Couleurs" hint="Échantillons avec code hex — survol pour la valeur complète.">
          <div className="design-color-tiles">
            {colorEntries.map(([name, hex]) => {
              const valid = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex);
              return (
                <article key={name} className="design-color-tile">
                  <div
                    className="design-color-tile__swatch"
                    style={valid ? { backgroundColor: hex } : undefined}
                    title={hex}
                  />
                  <div className="design-color-tile__meta">
                    <span className="design-color-tile__name">{name}</span>
                    <code className="design-color-tile__hex">{hex}</code>
                  </div>
                </article>
              );
            })}
          </div>
        </DsCard>
      ) : null}

      {typoRoles.length > 0 ? (
        <DsCard eyebrow="Tokens" title="Typographie" hint="Aperçu sur fond neutre ; propriétés listées sous l’échantillon.">
          <div className="design-typo-tiles">
            {typoRoles.map((role) => {
              const d = tokens.typographyDetails[role] ?? {};
              const style: CSSProperties = {
                fontFamily: d.fontFamily?.replace(/^["']|["']$/g, "") ?? "inherit",
                fontSize: d.fontSize ?? "1rem",
                fontWeight: d.fontWeight as CSSProperties["fontWeight"],
                lineHeight: d.lineHeight ?? 1.35,
                letterSpacing: d.letterSpacing,
                textTransform: d.textTransform as CSSProperties["textTransform"],
              };
              return (
                <article key={role} className="design-typo-tile">
                  <div className="design-typo-tile__head">
                    <span className="design-typo-tile__role">{role}</span>
                  </div>
                  <div className="design-typo-tile__canvas">
                    <div className="design-typo-tile__sample" style={style}>
                      Aa Bb Cc — The quick brown fox
                    </div>
                  </div>
                  <dl className="design-typo-tile__props">
                    {Object.entries(d).map(([k, v]) => (
                      <div key={k} className="design-typo-tile__prop">
                        <dt>{k}</dt>
                        <dd>
                          <code>{v}</code>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
        </DsCard>
      ) : null}

      {spacingEntries.length > 0 ? (
        <DsCard
          eyebrow="Tokens"
          title="Espacements"
          hint={`Trois repères sur fond grille ; l’espace entre eux correspond à la valeur résolue (refs {spacing.*}).`}
        >
          <div className="design-spacing-tiles">
            {spacingEntries.map(([k, raw]) => {
              const gap = resolveCssLeaf(raw, tokens);
              return (
                <article key={k} className="design-spacing-tile">
                  <div className="design-spacing-tile__meta">
                    <span className="design-spacing-tile__name">{k}</span>
                    <code className="design-spacing-tile__val">{gap}</code>
                  </div>
                  <div className="design-spacing-tile__canvas" aria-hidden>
                    <div className="design-spacing-tile__track" style={{ gap }}>
                      <span className="design-spacing-tile__pip" />
                      <span className="design-spacing-tile__pip" />
                      <span className="design-spacing-tile__pip" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </DsCard>
      ) : null}

      {roundedEntries.length > 0 ? (
        <DsCard eyebrow="Tokens" title="Rayons" hint="Blocs larges sur toile à damier pour juger l’arrondi au bord.">
          <div className="design-rounded-tiles">
            {roundedEntries.map(([k, raw]) => {
              const r = resolveCssLeaf(raw, tokens);
              return (
                <article key={k} className="design-rounded-tile">
                  <div className="design-rounded-tile__meta">
                    <span className="design-rounded-tile__name">{k}</span>
                    <code className="design-rounded-tile__val">{r}</code>
                  </div>
                  <div className="design-rounded-tile__canvas">
                    <div
                      className="design-rounded-tile__swatch"
                      style={{
                        borderRadius: r,
                        background: `linear-gradient(145deg, ${accentFill} 0%, rgba(6, 182, 212, 0.55) 48%, rgba(15, 23, 42, 0.9) 100%)`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.35)`,
                      }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </DsCard>
      ) : null}

      {componentEntries.length > 0 ? (
        <DsCard
          eyebrow="Bibliothèque"
          title="Composants"
          hint="Aperçu sur fond type « frame » ; les noms contenant button, input, row, etc. affichent un rendu natif stylé."
        >
          <div className="design-component-tiles">
            {componentEntries.map(([name, props]) => {
              const kind = inferNativeKind(name);
              const previewStyle = buildComponentPreviewStyle(props, tokens);
              return (
                <article key={name} className="design-component-tile">
                  <header className="design-component-tile__head">
                    <span className="design-component-tile__name">{name}</span>
                    {kind ? <span className="design-component-tile__badge">Aperçu natif</span> : null}
                  </header>
                  {kind ? (
                    <div className="design-preview-stage design-preview-stage--padded">
                      <NativePreview kind={kind} style={previewStyle} name={name} />
                    </div>
                  ) : null}
                  <dl className="design-component-tile__props">
                    {Object.entries(props).map(([pk, pv]) => (
                      <div key={pk} className="design-component-tile__prop">
                        <dt>{pk}</dt>
                        <dd>
                          <code title={pv}>{pv}</code>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
        </DsCard>
      ) : null}
    </div>
  );
}
