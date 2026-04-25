import type { TaskStudioDiffPayload, TaskSuggestedAction } from "./api";

/** Persistance locale de l’historique de chat par projet (navigateur). */
const PREFIX = "akasha-code-studio-chat-v2:";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  task_id?: string;
  suggested_actions?: TaskSuggestedAction[];
  /** Diff fichiers / snapshot de tâche (assistant uniquement). */
  studio_diff?: TaskStudioDiffPayload | null;
};

function normalizeMessage(m: unknown): ChatMessage | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  if (typeof o.text !== "string") return null;
  if (o.role !== "user" && o.role !== "assistant") return null;
  const task_id = typeof o.task_id === "string" ? o.task_id : undefined;
  const suggested_actions = Array.isArray(o.suggested_actions)
    ? (o.suggested_actions as TaskSuggestedAction[]).filter(
        (a) =>
          a &&
          typeof a === "object" &&
          typeof (a as TaskSuggestedAction).id === "string" &&
          typeof (a as TaskSuggestedAction).label === "string" &&
          ((a as TaskSuggestedAction).kind === "message" || (a as TaskSuggestedAction).kind === "ui"),
      )
    : undefined;
  let studio_diff: TaskStudioDiffPayload | null | undefined;
  const sd = o.studio_diff;
  if (sd && typeof sd === "object" && typeof (sd as TaskStudioDiffPayload).task_id === "string") {
    const files = (sd as TaskStudioDiffPayload).files;
    if (Array.isArray(files)) {
      const rawFiles = files.filter(
        (f) =>
          f &&
          typeof f === "object" &&
          typeof (f as { path: string }).path === "string" &&
          typeof (f as { status: string }).status === "string" &&
          typeof (f as { diff: string }).diff === "string",
      );
      studio_diff = {
        task_id: (sd as TaskStudioDiffPayload).task_id,
        captured_at: String((sd as TaskStudioDiffPayload).captured_at ?? ""),
        files: rawFiles.map((f) => {
          const row = f as { path: string; status: string; diff: string; truncated?: boolean };
          return {
            path: row.path,
            status: row.status,
            diff: row.diff,
            truncated: Boolean(row.truncated),
          };
        }),
      };
    }
  }
  return { role: o.role, text: o.text, task_id, suggested_actions, studio_diff };
}

export function loadChatMessages(projectId: string): ChatMessage[] {
  if (typeof localStorage === "undefined") return [];
  const tryKey = (key: string): { present: boolean; messages: ChatMessage[] } => {
    const raw = localStorage.getItem(key);
    if (raw === null) return { present: false, messages: [] };
    try {
      const j = JSON.parse(raw) as unknown;
      if (!Array.isArray(j)) return { present: true, messages: [] };
      return {
        present: true,
        messages: j
          .map((row) => normalizeMessage(row))
          .filter((m): m is ChatMessage => m !== null)
          .slice(-200),
      };
    } catch {
      return { present: true, messages: [] };
    }
  };
  const v2 = tryKey(PREFIX + projectId);
  if (v2.present) return v2.messages;
  const legacy = tryKey("akasha-code-studio-chat-v1:" + projectId);
  return legacy.messages;
}

export function saveChatMessages(projectId: string, messages: ChatMessage[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PREFIX + projectId, JSON.stringify(messages.slice(-200)));
  } catch {
    /* quota ou mode privé */
  }
}
