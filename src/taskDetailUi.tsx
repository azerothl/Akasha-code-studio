import { useMemo, useState } from "react";
import type { TaskEventEntry } from "./api";
import { MarkdownBlock } from "./markdownBlock";

/** Garde la dernière entrée pour chaque clé, ordre d’affichage = ordre chronologique de la dernière occurrence. */
export function keepLastByKey<T>(items: T[], keyFn: (t: T) => string): T[] {
  const last = new Map<string, T>();
  const lastIdx = new Map<string, number>();
  items.forEach((item, i) => {
    const k = keyFn(item);
    last.set(k, item);
    lastIdx.set(k, i);
  });
  return [...last.entries()]
    .sort((a, b) => (lastIdx.get(a[0]) ?? 0) - (lastIdx.get(b[0]) ?? 0))
    .map(([, v]) => v);
}

function normalizeEventTypeSlug(t: string): string {
  return t
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "unknown";
}

export function eventTypeDataAttr(eventType: string): string {
  return normalizeEventTypeSlug(eventType);
}

function extractFromContentArray(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "string") parts.push(part);
    else if (part && typeof part === "object") {
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") parts.push(p.text);
      else if (p.type === "text" && typeof p.text === "string") parts.push(p.text);
    }
  }
  const joined = parts.join("\n").trim();
  return joined || null;
}

/** Texte « message » principal dans le payload d’un événement, si présent. */
export function extractEventDisplayMessage(payload: unknown): string | null {
  if (payload == null) return null;
  if (typeof payload === "string") {
    const t = payload.trim();
    return t || null;
  }
  if (typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  for (const k of ["message", "text", "detail", "reason", "answer", "summary"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const fromContent = extractFromContentArray(o.content);
  if (fromContent) return fromContent;
  return null;
}

export function formatEventFallback(ev: TaskEventEntry): string {
  const bits: string[] = [];
  if (ev.task_id) bits.push(`tâche ${ev.task_id}`);
  if (ev.payload != null && typeof ev.payload === "object") {
    const o = ev.payload as Record<string, unknown>;
    for (const k of ["tool", "tool_name", "name", "status", "phase", "path", "command"]) {
      if (o[k] != null && String(o[k]).trim() !== "") {
        bits.push(`${k}: ${String(o[k]).slice(0, 160)}`);
      }
    }
    if (bits.length === (ev.task_id ? 1 : 0)) {
      const j = JSON.stringify(o);
      bits.push(j.length > 280 ? `${j.slice(0, 280)}…` : j);
    }
  } else if (typeof ev.payload === "string" && ev.payload.trim()) {
    bits.push(ev.payload.trim());
  } else if (ev.payload !== undefined && ev.payload !== null) {
    bits.push(String(ev.payload));
  }
  return bits.length > 0 ? bits.join(" · ") : `(${ev.event_type})`;
}

export function textLooksLikeMarkdown(s: string): boolean {
  if (!s || s.length < 2) return false;
  return (
    /^#{1,6}\s/m.test(s) ||
    /^\s*[-*+]\s/m.test(s) ||
    /^\s*\d+\.\s/m.test(s) ||
    /```/.test(s) ||
    /(^|\n)\s*>\s/.test(s) ||
    /\[[^\]]+\]\([^)]+\)/.test(s) ||
    /\*\*[^*]+\*\*/.test(s) ||
    /(^|\s)_[^_][\s\S]*?_(\s|$)/.test(s) ||
    /(^|[^`])`[^`\n]+`([^`]|$)/.test(s) ||
    /^(\s*)\|[^\n]+\|\s*$/m.test(s)
  );
}

type TaskDetailEventRowProps = {
  ev: TaskEventEntry;
};

export function TaskDetailEventRow({ ev }: TaskDetailEventRowProps) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const slug = useMemo(() => eventTypeDataAttr(ev.event_type), [ev.event_type]);
  const displayMsg = useMemo(() => extractEventDisplayMessage(ev.payload), [ev.payload]);
  const bodyText = displayMsg ?? formatEventFallback(ev);
  const hasPayload = ev.payload !== undefined;
  return (
    <li className="task-detail-events-item">
      <div className="task-detail-event-head">
        <span className="task-detail-event-badge" data-event-type={slug}>
          {ev.event_type}
        </span>
        {ev.task_id ? (
          <code className="task-detail-event-taskid" title={ev.task_id}>
            {ev.task_id.length > 14 ? `${ev.task_id.slice(0, 8)}…` : ev.task_id}
          </code>
        ) : null}
        {hasPayload ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm task-detail-json-toggle"
            onClick={() => setJsonOpen((o) => !o)}
            aria-expanded={jsonOpen}
          >
            {jsonOpen ? "Masquer JSON" : "Voir JSON"}
          </button>
        ) : null}
        <span className="hint task-detail-event-at">{ev.at}</span>
      </div>
      <div className="task-detail-event-body">
        {displayMsg != null && textLooksLikeMarkdown(displayMsg) ? (
          <MarkdownBlock text={displayMsg} className="md-content task-detail-event-md" />
        ) : (
          <div className="task-detail-event-plain">{bodyText}</div>
        )}
      </div>
      {jsonOpen && hasPayload ? (
        <pre className="task-detail-event-payload">{JSON.stringify(ev.payload, null, 2)}</pre>
      ) : null}
    </li>
  );
}
