import type { CSSProperties } from "react";
import type { DesignParseResult } from "./designDoc";

type Props = { parsed: DesignParseResult };

/** Aperçu visuel des tokens DESIGN.md (couleurs, typo, espacements, composants). */
export function DesignVisualBoard({ parsed }: Props) {
  const { tokens } = parsed;
  const colorEntries = Object.entries(tokens.colors);
  const typoRoles = tokens.typographyKeys;
  const spacingEntries = Object.entries(tokens.spacing);
  const roundedEntries = Object.entries(tokens.rounded);
  const componentEntries = Object.entries(tokens.components);

  return (
    <div className="design-visual-board" aria-label="Aperçu visuel du design">
      {tokens.name ? (
        <div className="design-visual-block">
          <h3 className="design-visual-block-title">Identité</h3>
          <p className="design-visual-name">{tokens.name}</p>
          {tokens.description ? <p className="hint">{tokens.description}</p> : null}
        </div>
      ) : null}

      {colorEntries.length > 0 ? (
        <div className="design-visual-block">
          <h3 className="design-visual-block-title">Couleurs</h3>
          <div className="design-color-grid">
            {colorEntries.map(([name, hex]) => {
              const valid = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex);
              return (
                <div key={name} className="design-color-cell">
                  <div
                    className="design-color-swatch"
                    style={valid ? { backgroundColor: hex } : undefined}
                    title={hex}
                  />
                  <span className="design-color-label">{name}</span>
                  <code className="design-color-hex">{hex}</code>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {typoRoles.length > 0 ? (
        <div className="design-visual-block">
          <h3 className="design-visual-block-title">Typographie</h3>
          <div className="design-typo-grid">
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
                <div key={role} className="design-typo-card">
                  <div className="design-typo-role">{role}</div>
                  <div className="design-typo-sample" style={style}>
                    Aa Bb Cc — The quick brown fox
                  </div>
                  <ul className="design-typo-meta">
                    {Object.entries(d).map(([k, v]) => (
                      <li key={k}>
                        <code>{k}</code>: {v}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {spacingEntries.length > 0 || roundedEntries.length > 0 ? (
        <div className="design-visual-block">
          <h3 className="design-visual-block-title">Espacements & rayons</h3>
          {spacingEntries.length > 0 ? (
            <div className="design-chip-row">
              {spacingEntries.map(([k, v]) => (
                <span key={`sp-${k}`} className="design-chip">
                  <strong>{k}</strong> {v}
                </span>
              ))}
            </div>
          ) : null}
          {roundedEntries.length > 0 ? (
            <div className="design-chip-row">
              {roundedEntries.map(([k, v]) => (
                <span key={`rd-${k}`} className="design-chip design-chip-rounded">
                  <strong>{k}</strong> {v}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {componentEntries.length > 0 ? (
        <div className="design-visual-block">
          <h3 className="design-visual-block-title">Composants (clés YAML)</h3>
          <div className="design-component-grid">
            {componentEntries.map(([name, props]) => (
              <div key={name} className="design-component-card">
                <div className="design-component-name">{name}</div>
                <div className="design-component-props">
                  {props.map((p) => (
                    <span key={p} className="design-prop-chip">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
