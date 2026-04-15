/** Persistance du suivi de tâche agent par projet (rechargement de page). */
const PREFIX = "akasha-code-studio-task-v1:";

export type StoredActiveTask = { taskId: string; startedAt: number };

export function loadActiveTask(projectId: string): StoredActiveTask | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + projectId);
    if (!raw) return null;
    const j = JSON.parse(raw) as StoredActiveTask;
    if (typeof j?.taskId === "string" && j.taskId.length > 0) {
      return { taskId: j.taskId, startedAt: typeof j.startedAt === "number" ? j.startedAt : 0 };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveActiveTask(projectId: string, taskId: string) {
  if (typeof localStorage === "undefined") return;
  const payload: StoredActiveTask = { taskId, startedAt: Date.now() };
  try {
    localStorage.setItem(PREFIX + projectId, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearActiveTask(projectId: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PREFIX + projectId);
  } catch {
    /* ignore */
  }
}
