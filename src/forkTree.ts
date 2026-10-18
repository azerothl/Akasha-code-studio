export type ForkNode = {
  taskId: string;
  parentTaskId: string | null;
  cutIndex: number | null;
  label: string;
  active: boolean;
  status: string | null;
};

type ForkMessage = {
  role: string;
  text: string;
  task_id?: string;
  task_status?: string;
  fork_parent_task_id?: string;
  fork_cut_index?: number;
};

type ForkEvent = {
  event_type: string;
  task_id?: string | null;
  payload?: unknown;
};

function payloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function payloadNumber(payload: unknown, key: string): number | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildForkNodes(
  messages: ForkMessage[],
  events: ForkEvent[],
  activeTaskId: string | null,
): ForkNode[] {
  const nodes = new Map<string, ForkNode>();
  const ensure = (taskId: string): ForkNode => {
    const existing = nodes.get(taskId);
    if (existing) return existing;
    const created: ForkNode = {
      taskId,
      parentTaskId: null,
      cutIndex: null,
      label: taskId.slice(0, 8),
      active: taskId === activeTaskId,
      status: null,
    };
    nodes.set(taskId, created);
    return created;
  };

  for (const message of messages) {
    if (!message.task_id) continue;
    const node = ensure(message.task_id);
    if (message.task_status) node.status = message.task_status;
    if (message.role === "user" && message.text.trim()) {
      node.label = message.text.trim().slice(0, 80);
    }
    if (message.fork_parent_task_id) {
      node.parentTaskId = message.fork_parent_task_id;
      ensure(message.fork_parent_task_id);
    }
    if (typeof message.fork_cut_index === "number") node.cutIndex = message.fork_cut_index;
  }

  for (const event of events) {
    if (event.event_type !== "session_fork_created") continue;
    const child = event.task_id ?? payloadString(event.payload, "task_id");
    const parent = payloadString(event.payload, "fork_parent_task_id");
    if (!child) continue;
    const node = ensure(child);
    if (parent) {
      node.parentTaskId = parent;
      ensure(parent);
    }
    const cut = payloadNumber(event.payload, "fork_cut_index");
    if (cut !== null) node.cutIndex = cut;
  }

  for (const node of nodes.values()) node.active = node.taskId === activeTaskId;
  return [...nodes.values()];
}
