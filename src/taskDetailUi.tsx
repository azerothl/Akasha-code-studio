import { useMemo, useState } from "react";
import type { TaskEventEntry } from "./api";
import { MarkdownBlock } from "./markdownBlock";

export type TaskProgressLine = {
  progress_pct: number;
  message: string;
  task_id?: string | null;
};

/** Regroupe par `task_id` puis par `progress_pct` ; pour chaque couple on ne garde que le **dernier** message (stream). */
export function groupProgressByTaskThenPct(
  progress: TaskProgressLine[],
  fallbackTaskId: string,
): { taskId: string; pctGroups: { pct: number; line: TaskProgressLine }[] }[] {
  const taskKey = (p: TaskProgressLine) => (p.task_id && String(p.task_id).trim()) || fallbackTaskId;

  const taskOrder: string[] = [];
  const perTask = new Map<string, TaskProgressLine[]>();
  for (const line of progress) {
    const k = taskKey(line);
    if (!perTask.has(k)) {
      perTask.set(k, []);
      taskOrder.push(k);
    }
    perTask.get(k)!.push(line);
  }

  const out: { taskId: string; pctGroups: { pct: number; line: TaskProgressLine }[] }[] = [];
  for (const taskId of taskOrder) {
    const lines = perTask.get(taskId)!;
    const byPct = new Map<number, TaskProgressLine>();
    for (const line of lines) {
      byPct.set(line.progress_pct, line);
    }
    const sortedPcts = [...byPct.keys()].sort((a, b) => a - b);
    out.push({
      taskId,
      pctGroups: sortedPcts.map((pct) => ({ pct, line: byPct.get(pct)! })),
    });
  }
  return out;
}

type TaskDetailProgressViewProps = {
  progress: TaskProgressLine[];
  rootTaskId: string;
};

export function TaskDetailProgressView({ progress, rootTaskId }: TaskDetailProgressViewProps) {
  const grouped = useMemo(() => groupProgressByTaskThenPct(progress, rootTaskId), [progress, rootTaskId]);
  if (grouped.length === 0) return null;
  return (
    <div className="task-detail-progress-root">
      {grouped.map(({ taskId, pctGroups }) => (
        <section key={taskId} className="task-detail-progress-task-block">
          <div className="task-detail-progress-task-head">
            <span className="task-detail-progress-task-label">Tâche</span>{" "}
            <code className="task-detail-progress-taskid" title={taskId}>
              {taskId.length > 24 ? `${taskId.slice(0, 12)}…${taskId.slice(-8)}` : taskId}
            </code>
          </div>
          <div className="task-detail-progress-pct-blocks">
            {pctGroups.map(({ pct, line }) => (
              <div key={`${taskId}-${pct}`} className="task-detail-progress-pct-block">
                <div className="task-detail-progress-pct-head">
                  <span className="task-detail-progress-pct-value">{pct}%</span>
                </div>
                <div className="task-detail-progress-message-line">{line.message}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
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
  /** Dans une section déjà titrée par le type d’événement, masquer le badge du type. */
  hideTypeBadge?: boolean;
};

function eventTaskKey(ev: TaskEventEntry, rootTaskId: string): string {
  return (ev.task_id && String(ev.task_id).trim()) || rootTaskId;
}

/** Une entrée par couple (`event_type`, `task_id`) : garde le dernier événement (ordre `at`), pour absorber le stream. */
export function dedupeEventsLastPerTaskAndType(events: TaskEventEntry[], rootTaskId: string): TaskEventEntry[] {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const last = new Map<string, TaskEventEntry>();
  for (const ev of sorted) {
    const k = `${ev.event_type}\0${eventTaskKey(ev, rootTaskId)}`;
    last.set(k, ev);
  }
  return Array.from(last.values()).sort((a, b) => a.at.localeCompare(b.at));
}

/** Ordre des groupes = première apparition chronologique du type. */
export function groupEventsByTypeInOrder(events: TaskEventEntry[]): { eventType: string; items: TaskEventEntry[] }[] {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const typeOrder: string[] = [];
  const byType = new Map<string, TaskEventEntry[]>();
  for (const ev of sorted) {
    if (!byType.has(ev.event_type)) {
      byType.set(ev.event_type, []);
      typeOrder.push(ev.event_type);
    }
    byType.get(ev.event_type)!.push(ev);
  }
  return typeOrder.map((eventType) => ({
    eventType,
    items: byType.get(eventType)!,
  }));
}

type TaskDetailEventsGroupedProps = {
  events: TaskEventEntry[];
  rootTaskId: string;
};

export function TaskDetailEventsGrouped({ events, rootTaskId }: TaskDetailEventsGroupedProps) {
  const groups = useMemo(() => {
    const deduped = dedupeEventsLastPerTaskAndType(events, rootTaskId);
    return groupEventsByTypeInOrder(deduped);
  }, [events, rootTaskId]);
  return (
    <div className="task-detail-events-grouped">
      {groups.map(({ eventType, items }) => {
        const slug = eventTypeDataAttr(eventType);
        return (
          <section key={eventType} className="task-detail-event-group" data-event-type={slug}>
            <header className="task-detail-event-group-head">
              <span className="task-detail-event-group-title">{eventType}</span>
              <span className="hint task-detail-event-group-count">{items.length}</span>
            </header>
            <ul className="task-detail-events task-detail-events--in-group">
              {items.map((ev) => (
                <TaskDetailEventRow
                  key={`ev-${eventType}-${eventTaskKey(ev, rootTaskId)}-${ev.at}`}
                  ev={ev}
                  hideTypeBadge
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function TaskDetailEventRow({ ev, hideTypeBadge }: TaskDetailEventRowProps) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const slug = useMemo(() => eventTypeDataAttr(ev.event_type), [ev.event_type]);
  const displayMsg = useMemo(() => extractEventDisplayMessage(ev.payload), [ev.payload]);
  const bodyText = displayMsg ?? formatEventFallback(ev);
  const hasPayload = ev.payload !== undefined;
  return (
    <li className="task-detail-events-item">
      <div className="task-detail-event-head">
        {hideTypeBadge ? null : (
          <span className="task-detail-event-badge" data-event-type={slug}>
            {ev.event_type}
          </span>
        )}
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
