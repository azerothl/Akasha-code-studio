import { normalizeHttpError } from "./api";

export type TerminalSession = { session_id: string; cols: number; rows: number; exit_code?: number | null };
export type TerminalShell = { id: string; label: string; argv: string[] };
export type TerminalCatalogue = { sessions: TerminalSession[]; shells: TerminalShell[]; can_create: boolean };
export type TerminalOutput = { data_b64: string; bytes: number; next_cursor: number; truncated: boolean; exit_code?: number | null };
export type TaskArtifact = { id: string; task_id: string; kind: string; mime: string; bytes: number; created_at: string; details: unknown };

async function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method, signal, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  if (!response.ok) throw await normalizeHttpError(method, path, response);
  return response.json() as Promise<T>;
}
const terminals = (project: string) => `/api/studio/projects/${encodeURIComponent(project)}/terminal/sessions`;
export const listProjectTerminals = (project: string, signal?: AbortSignal) => request<TerminalCatalogue>(terminals(project), "GET", undefined, signal);
export const createProjectTerminal = (project: string, argv: string[]) => request<{ session_id: string }>(terminals(project), "POST", { argv, cols: 80, rows: 24, idle_timeout_secs: 900 });
export const terminalInput = (project: string, session: string, text: string) => request(`${terminals(project)}/${encodeURIComponent(session)}/input`, "POST", { text });
export const terminalResize = (project: string, session: string, cols: number, rows: number) => request(`${terminals(project)}/${encodeURIComponent(session)}/resize`, "POST", { cols, rows });
export const terminalOutput = (project: string, session: string, cursor: number, signal?: AbortSignal) => request<TerminalOutput>(`${terminals(project)}/${encodeURIComponent(session)}/output?cursor=${cursor}`, "GET", undefined, signal);
export const closeProjectTerminal = (project: string, session: string) => request(`${terminals(project)}/${encodeURIComponent(session)}`, "DELETE");
export const listTaskArtifacts = (task: string, signal?: AbortSignal) => request<{ artifacts: TaskArtifact[] }>(`/api/tasks/${encodeURIComponent(task)}/artifacts`, "GET", undefined, signal);
export const readTaskArtifact = (task: string, id: string, signal?: AbortSignal) => request<{ artifact: TaskArtifact; data_base64: string }>(`/api/tasks/${encodeURIComponent(task)}/artifacts/${encodeURIComponent(id)}`, "GET", undefined, signal);
export const decodeBytes = (data: string) => Uint8Array.from(atob(data), char => char.charCodeAt(0));
