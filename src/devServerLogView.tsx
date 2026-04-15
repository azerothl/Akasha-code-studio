import { useMemo } from "react";
import { AnsiUp } from "ansi_up";

const ansiUp = new AnsiUp();
ansiUp.escape_html = true;

/** Préfixes [stdout] / [stderr] en couleurs discrètes (SGR valides). */
function prettifyStreamPrefixes(raw: string): string {
  return raw
    .replace(/^\[stdout\]\s*/gm, "\x1b[38;5;109m[stdout]\x1b[0m ")
    .replace(/^\[stderr\]\s*/gm, "\x1b[38;5;214m[stderr]\x1b[0m ");
}

/**
 * Certaines chaînes perdent le caractère ESC ; Vite affiche alors littéralement `[32m…`.
 * On réinjecte ESC devant les séquences SGR `[\d;…m` si elles ne sont pas déjà précédées de `\x1b`.
 */
function repairBrokenSgrSequences(raw: string): string {
  return raw.replace(/(?<!\x1b)\[([\d;]+)m/g, "\x1b[$1m");
}

export function formatDevServerLogHtml(raw: string): string {
  const pipeline = repairBrokenSgrSequences(prettifyStreamPrefixes(raw));
  return ansiUp.ansi_to_html(pipeline);
}

export type DevServerLogViewProps = {
  text: string;
  emptyHint: string;
};

/**
 * Sortie colorée du `npm run dev` (ANSI / séquences Vite réparées si besoin).
 */
export function DevServerLogView({ text, emptyHint }: DevServerLogViewProps) {
  const html = useMemo(() => (text.trim() ? formatDevServerLogHtml(text) : ""), [text]);

  if (!text.trim()) {
    return (
      <pre className="preview-dev-log preview-dev-log--empty" title="Logs du serveur">
        {emptyHint}
      </pre>
    );
  }

  return (
    <div
      className="preview-dev-log preview-dev-log--html"
      title="Logs du serveur"
      // Contenu issu du daemon local ; ansi_up échappe le HTML hors séquences ANSI.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
