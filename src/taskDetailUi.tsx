import { useMemo, useState } from "react";
import type { TaskEventEntry } from "./api";
import { MarkdownBlock } from "./markdownBlock";

export type TaskProgressLine = {
  progress_pct: number;
  message: string;
  task_id?: string | null;
};

function collapseStreamedProgressLines(progress: TaskProgressLine[], fallbackTaskId: string): TaskProgressLine[] {
  const lastByTaskPct = new Map<string, TaskProgressLine>();
  for (const line of progress) {
    const taskId = (line.task_id && String(line.task_id).trim()) || fallbackTaskId;
    const key = `${taskId}\0${line.progress_pct}`;
    lastByTaskPct.delete(key);
    lastByTaskPct.set(key, { ...line, task_id: taskId });
  }
  return Array.from(lastByTaskPct.values());
}

function payloadObject(payload: unknown): Record<string, unknown> | null {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}

function payloadString(payload: unknown, key: string): string | null {
  const o = payloadObject(payload);
  const v = o?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function payloadNumber(payload: unknown, key: string): number | null {
  const o = payloadObject(payload);
  const v = o?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function shortTaskId(taskId: string): string {
  return taskId.length > 24 ? `${taskId.slice(0, 12)}…${taskId.slice(-8)}` : taskId;
}

function eventTaskKey(ev: TaskEventEntry, rootTaskId: string): string {
  return (ev.task_id && String(ev.task_id).trim()) || rootTaskId;
}

export function progressLinesFromEvents(events: TaskEventEntry[], rootTaskId: string): TaskProgressLine[] {
  const out: TaskProgressLine[] = [];
  for (const ev of events) {
    if (ev.event_type !== "progress_update") continue;
    const pct = payloadNumber(ev.payload, "progress_pct");
    const message = payloadString(ev.payload, "message");
    const payloadTaskId = payloadString(ev.payload, "task_id");
    if (pct == null || !message) continue;
    out.push({
      progress_pct: pct,
      message,
      task_id: payloadTaskId ?? eventTaskKey(ev, rootTaskId),
    });
  }
  return out;
}

export function mergeProgressWithEventProgress(
  progress: TaskProgressLine[],
  events: TaskEventEntry[],
  rootTaskId: string,
): TaskProgressLine[] {
  const out = [...progress];
  const seen = new Set(
    out.map((p) => `${p.task_id ?? rootTaskId}\0${p.progress_pct}\0${p.message}`),
  );
  for (const p of progressLinesFromEvents(events, rootTaskId)) {
    const k = `${p.task_id ?? rootTaskId}\0${p.progress_pct}\0${p.message}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

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
            <span className="task-detail-progress-task-label">
              {taskId === rootTaskId ? "Tâche racine" : "Sous-agent"}
            </span>{" "}
            <code className="task-detail-progress-taskid" title={taskId}>
              {shortTaskId(taskId)}
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

function normalizeSemanticText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function semanticEventPayloadKey(ev: TaskEventEntry): string {
  const o = payloadObject(ev.payload);
  const direct = [
    payloadString(ev.payload, "tool_call_id"),
    payloadString(ev.payload, "tool_name"),
    payloadString(ev.payload, "tool"),
    payloadString(ev.payload, "name"),
    payloadString(ev.payload, "agent"),
    payloadString(ev.payload, "agent_type"),
    payloadString(ev.payload, "subtask_id"),
    payloadString(ev.payload, "task_id"),
    payloadString(ev.payload, "step_id"),
    payloadString(ev.payload, "command"),
    payloadString(ev.payload, "path"),
    payloadString(ev.payload, "status"),
  ]
    .filter(Boolean)
    .join("|");
  if (direct) return direct;
  const display = extractEventDisplayMessage(ev.payload);
  if (display) return normalizeSemanticText(display).slice(0, 220);
  if (!o) return "";
  const stable = JSON.stringify(o);
  return stable.length > 280 ? stable.slice(0, 280) : stable;
}

type EventCategory = "subagents" | "tools" | "other";

function categoryForEventType(eventType: string): EventCategory {
  const t = eventType.toLowerCase();
  if (t.includes("tool")) return "tools";
  if (t.includes("sub_agent") || t.includes("subtask") || t.includes("task_decomposed") || t.includes("task_created")) {
    return "subagents";
  }
  return "other";
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

/** Une entrée par couple (`event_type`, `task_id`, clé sémantique payload) : garde le dernier événement (ordre `at`). */
export function dedupeEventsLastPerTaskAndType(events: TaskEventEntry[], rootTaskId: string): TaskEventEntry[] {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const last = new Map<string, TaskEventEntry>();
  for (const ev of sorted) {
    const k = `${ev.event_type}\0${eventTaskKey(ev, rootTaskId)}\0${semanticEventPayloadKey(ev)}`;
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

type WorkflowStep = {
  id: string;
  taskId?: string;
  stepId?: string;
  agent?: string;
  title: string;
  status: "planned" | "running" | "completed" | "failed" | "info";
  at: string;
  details?: string[];
  progress: TaskProgressLine[];
};

function statusLabel(s: WorkflowStep["status"]): string {
  switch (s) {
    case "planned":
      return "planifié";
    case "running":
      return "en cours";
    case "completed":
      return "terminé";
    case "failed":
      return "échec";
    default:
      return "info";
  }
}

function workflowStatusFromEvent(ev: TaskEventEntry): WorkflowStep["status"] {
  if (ev.event_type === "studio_worker_state_changed") {
    const state = payloadString(ev.payload, "state");
    if (state === "completed") return "completed";
    if (state === "failed" || state === "blocked" || state === "stopped") return "failed";
    if (state === "spawned" || state === "ready" || state === "running") return "running";
    return "info";
  }
  if (ev.event_type === "subtask_completed" || ev.event_type === "task_completed") return "completed";
  if (ev.event_type === "task_failed" || ev.event_type === "task_cancelled") return "failed";
  if (ev.event_type === "subtask_started" || ev.event_type === "sub_agent_spawned") return "running";
  return "info";
}

function buildWorkflowSteps(events: TaskEventEntry[], rootTaskId: string): WorkflowStep[] {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const progressByTask = new Map<string, TaskProgressLine[]>();
  for (const p of progressLinesFromEvents(sorted, rootTaskId)) {
    const k = p.task_id || rootTaskId;
    const arr = progressByTask.get(k) ?? [];
    arr.push(p);
    progressByTask.set(k, arr);
  }

  const steps = new Map<string, WorkflowStep>();
  const ensure = (key: string, seed: Omit<WorkflowStep, "progress">): WorkflowStep => {
    const existing = steps.get(key);
    if (existing) return existing;
    const next: WorkflowStep = { ...seed, progress: [] };
    steps.set(key, next);
    return next;
  };

  for (const ev of sorted) {
    if (ev.event_type === "plan_proposed") {
      const o = payloadObject(ev.payload);
      const rawSteps = Array.isArray(o?.steps) ? o?.steps : [];
      rawSteps.forEach((raw, idx) => {
        const step = payloadObject(raw);
        const stepId = typeof step?.step_id === "string" ? step.step_id : `plan-${idx + 1}`;
        const agent = typeof step?.agent_type === "string" ? step.agent_type : undefined;
        const intent = typeof step?.intent_preview === "string" ? step.intent_preview : undefined;
        const deliverables = Array.isArray(step?.deliverables)
          ? step?.deliverables.map(String).filter(Boolean)
          : [];
        ensure(`step:${stepId}`, {
          id: `step:${stepId}`,
          stepId,
          agent,
          title: `Étape ${idx + 1}${agent ? ` · ${agent}` : ""}`,
          status: "planned",
          at: ev.at,
          details: [
            intent ? `Objectif: ${intent}` : "",
            deliverables.length ? `Livrables: ${deliverables.join(", ")}` : "",
          ].filter(Boolean),
        });
      });
      continue;
    }

    if (ev.event_type === "task_decomposed") {
      const count = payloadNumber(ev.payload, "subtask_count");
      const agentsRaw = payloadObject(ev.payload)?.agents;
      const agents = Array.isArray(agentsRaw) ? agentsRaw.map(String).join(", ") : "";
      ensure(`decomposed:${ev.at}`, {
        id: `decomposed:${ev.at}`,
        taskId: rootTaskId,
        title: `Décomposition${count != null ? ` · ${count} sous-tâche(s)` : ""}`,
        status: "info",
        at: ev.at,
        details: agents ? [`Agents: ${agents}`] : undefined,
      });
      continue;
    }

    if (ev.event_type === "sub_agent_spawned" || ev.event_type === "subtask_started") {
      const taskId = payloadString(ev.payload, "task_id") ?? payloadString(ev.payload, "subtask_id") ?? eventTaskKey(ev, rootTaskId);
      const stepId = payloadString(ev.payload, "step_id") ?? undefined;
      const agent = payloadString(ev.payload, "agent") ?? payloadString(ev.payload, "agent_type") ?? undefined;
      const key = taskId ? `task:${taskId}` : `event:${ev.at}`;
      const step = ensure(key, {
        id: key,
        taskId,
        stepId,
        agent,
        title: `${agent ? `Sous-agent ${agent}` : "Sous-agent"}${stepId ? ` · ${stepId}` : ""}`,
        status: "running",
        at: ev.at,
        details: taskId ? [`Tâche: ${taskId}`] : undefined,
      });
      step.status = "running";
      step.at = step.at < ev.at ? step.at : ev.at;
      if (agent && !step.agent) step.agent = agent;
      if (stepId && !step.stepId) step.stepId = stepId;
      continue;
    }

    if (ev.event_type === "subtask_completed") {
      const taskId = payloadString(ev.payload, "subtask_id") ?? payloadString(ev.payload, "task_id") ?? eventTaskKey(ev, rootTaskId);
      const stepId = payloadString(ev.payload, "step_id") ?? undefined;
      const key = taskId ? `task:${taskId}` : `event:${ev.at}`;
      const step = ensure(key, {
        id: key,
        taskId,
        stepId,
        title: `Sous-tâche${stepId ? ` · ${stepId}` : ""}`,
        status: "completed",
        at: ev.at,
      });
      step.status = workflowStatusFromEvent(ev);
      step.details = [
        ...(step.details ?? []),
        payloadString(ev.payload, "content_preview") ? `Résultat: ${payloadString(ev.payload, "content_preview")}` : "",
        payloadString(ev.payload, "status") ? `Statut: ${payloadString(ev.payload, "status")}` : "",
      ].filter(Boolean);
      continue;
    }

    if (ev.event_type === "studio_worker_state_changed") {
      const taskId = payloadString(ev.payload, "worker_task_id") ?? payloadString(ev.payload, "task_id") ?? eventTaskKey(ev, rootTaskId);
      const agent = payloadString(ev.payload, "assigned_agent") ?? undefined;
      const state = payloadString(ev.payload, "state") ?? "unknown";
      const key = taskId ? `worker:${taskId}` : `worker:${ev.at}`;
      const step = ensure(key, {
        id: key,
        taskId,
        agent,
        title: `Worker ${agent ?? "studio"} · ${state}`,
        status: workflowStatusFromEvent(ev),
        at: ev.at,
        details: taskId ? [`Worker task: ${taskId}`] : undefined,
      });
      step.status = workflowStatusFromEvent(ev);
      step.details = [...(step.details ?? []), `State: ${state}`];
      continue;
    }

    if (ev.event_type === "studio_conflict_notice") {
      const key = `conflict:${ev.at}`;
      const filesRaw = payloadObject(ev.payload)?.files;
      const files = Array.isArray(filesRaw) ? filesRaw.map(String).join(", ") : "";
      ensure(key, {
        id: key,
        taskId: eventTaskKey(ev, rootTaskId),
        title: "Conflit détecté",
        status: "failed",
        at: ev.at,
        details: [
          payloadString(ev.payload, "reason") ?? "Touches concurrentes détectées",
          files ? `Fichiers: ${files}` : "",
        ].filter(Boolean),
      });
      continue;
    }
  }

  for (const step of steps.values()) {
    if (step.taskId) {
      const taskProgress = progressByTask.get(step.taskId) ?? [];
      step.progress = collapseStreamedProgressLines(taskProgress, rootTaskId);
    }
  }
  return [...steps.values()].sort((a, b) => a.at.localeCompare(b.at));
}

export function TaskDetailWorkflowView({
  events,
  rootTaskId,
}: {
  events: TaskEventEntry[];
  rootTaskId: string;
}) {
  const steps = useMemo(() => buildWorkflowSteps(events, rootTaskId), [events, rootTaskId]);
  if (steps.length === 0) {
    return <p className="hint">Aucun sous-agent ou plan d’orchestration détecté pour cette tâche.</p>;
  }
  return (
    <ol className="task-detail-workflow" aria-label="Workflow de la tâche">
      {steps.map((step, idx) => (
        <li key={step.id} className="task-detail-workflow-item" data-status={step.status}>
          <div className="task-detail-workflow-marker">{idx + 1}</div>
          <div className="task-detail-workflow-card">
            <div className="task-detail-workflow-head">
              <span className="task-detail-workflow-title">{step.title}</span>
              <span className="task-detail-workflow-status">{statusLabel(step.status)}</span>
            </div>
            <div className="task-detail-workflow-meta">
              {step.taskId ? (
                <code title={step.taskId}>{shortTaskId(step.taskId)}</code>
              ) : null}
              {step.stepId ? <span>step: {step.stepId}</span> : null}
              <span>{step.at}</span>
            </div>
            {step.details?.length ? (
              <ul className="task-detail-workflow-details">
                {step.details.slice(0, 4).map((d, i) => (
                  <li key={`${step.id}-d-${i}`}>{d.length > 500 ? `${d.slice(0, 500)}…` : d}</li>
                ))}
              </ul>
            ) : null}
            {step.progress.length ? (
              <ul className="task-detail-workflow-progress">
                {step.progress.slice(-4).map((p, i) => (
                  <li key={`${step.id}-p-${i}`}>
                    <strong>{p.progress_pct}%</strong> {p.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TaskDetailEventsGrouped({ events, rootTaskId }: TaskDetailEventsGroupedProps) {
  const categories = useMemo(() => {
    const deduped = dedupeEventsLastPerTaskAndType(events, rootTaskId);
    const groupedByType = groupEventsByTypeInOrder(deduped);
    const entries: { key: EventCategory; title: string; groups: { eventType: string; items: TaskEventEntry[] }[] }[] = [
      { key: "subagents", title: "Sous-agents", groups: [] },
      { key: "tools", title: "Outils", groups: [] },
      { key: "other", title: "Autres événements", groups: [] },
    ];
    for (const g of groupedByType) {
      const cat = categoryForEventType(g.eventType);
      entries.find((e) => e.key === cat)?.groups.push(g);
    }
    return entries.filter((e) => e.groups.length > 0);
  }, [events, rootTaskId]);
  return (
    <div className="task-detail-events-grouped">
      {categories.map((category) => {
        const total = category.groups.reduce((sum, g) => sum + g.items.length, 0);
        return (
          <section key={category.key} className="task-detail-events-category" data-event-category={category.key}>
            <header className="task-detail-events-category-head">
              <span className="task-detail-events-category-title">{category.title}</span>
              <span className="hint task-detail-events-category-count">{total}</span>
            </header>
            {category.groups.map(({ eventType, items }) => {
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
                        key={`ev-${eventType}-${eventTaskKey(ev, rootTaskId)}-${semanticEventPayloadKey(ev)}-${ev.at}`}
                        ev={ev}
                        hideTypeBadge
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
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
        {typeof ev.schema_version === "number" ? (
          <span className="hint" title="Version du schéma événement">
            v{ev.schema_version}
          </span>
        ) : null}
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
