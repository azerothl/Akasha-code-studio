/** Persistance locale de l’historique de chat par projet (navigateur). */
const PREFIX = "akasha-code-studio-chat-v1:";

export type ChatMessage = { role: "user" | "assistant"; text: string };

export function loadChatMessages(projectId: string): ChatMessage[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFIX + projectId);
    if (!raw) return [];
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    return j
      .filter(
        (m: unknown): m is ChatMessage =>
          !!m &&
          typeof m === "object" &&
          "text" in m &&
          typeof (m as ChatMessage).text === "string" &&
          ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant"),
      )
      .slice(-200);
  } catch {
    return [];
  }
}

export function saveChatMessages(projectId: string, messages: ChatMessage[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PREFIX + projectId, JSON.stringify(messages.slice(-200)));
  } catch {
    /* quota ou mode privé */
  }
}
