import type { TaskSuggestedAction } from "./api";

/** Persistance locale de l’historique de chat par projet (navigateur). */
const PREFIX = "akasha-code-studio-chat-v2:";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  task_id?: string;
  suggested_actions?: TaskSuggestedAction[];
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
  return { role: o.role, text: o.text, task_id, suggested_actions };
}

export function loadChatMessages(projectId: string): ChatMessage[] {
  if (typeof localStorage === "undefined") return [];
  const tryKey = (key: string): ChatMessage[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const j = JSON.parse(raw) as unknown;
      if (!Array.isArray(j)) return [];
      return j
        .map((row) => normalizeMessage(row))
        .filter((m): m is ChatMessage => m !== null)
        .slice(-200);
    } catch {
      return [];
    }
  };
  const v2 = tryKey(PREFIX + projectId);
  if (v2.length) return v2;
  const legacy = tryKey("akasha-code-studio-chat-v1:" + projectId);
  return legacy;
}

export function saveChatMessages(projectId: string, messages: ChatMessage[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PREFIX + projectId, JSON.stringify(messages.slice(-200)));
  } catch {
    /* quota ou mode privé */
  }
}
