const LAST_PROJECT_KEY = "akasha-code-studio:last-project-id";

export function getLastProjectId(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_PROJECT_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function setLastProjectId(projectId: string) {
  if (typeof localStorage === "undefined") return;
  try {
    if (!projectId.trim()) return;
    localStorage.setItem(LAST_PROJECT_KEY, projectId.trim());
  } catch {
    /* ignore storage failures */
  }
}

export function clearLastProjectId() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    /* ignore storage failures */
  }
}
