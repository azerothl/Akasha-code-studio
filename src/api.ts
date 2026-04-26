/** Base URL: dev server proxies /api to the daemon (see vite.config.ts). */
const api = (path: string) => path.startsWith("/") ? path : `/${path}`;

export type StudioProject = { id: string; name: string; path: string };

export type Evolution = {
  id: string;
  branch: string;
  status: string;
  created_at: string;
  root_task_id?: string | null;
};

/** État de l’index code-RAG du projet (recherche sémantique / contexte agent).
 * - `absent` : aucun index n’existe encore
 * - `stale`  : index présent mais obsolète (fichiers modifiés depuis)
 * - `ready`  : index à jour
 */
export type CodeRagStatus = {
  status: "absent" | "stale" | "ready";
  files_indexed: number;
  chunks_indexed: number;
  built_at: string | null;
  stale: boolean;
};

export type StudioProjectMeta = {
  id: string;
  name: string;
  created_at: string;
  evolutions?: Evolution[];
  tech_stack?: string | null;
  verify_skip?: boolean;
  verify_argv?: string[] | null;
  verify_timeout_sec?: number | null;
  /** Résumé évolution / session (réinjecté dans les messages). */
  evolution_summary?: string | null;
  /** Notes de politique outils / périmètre (réinjectées). */
  policy_notes?: string | null;
  /** Branche Git courante (`git rev-parse --abbrev-ref HEAD`), si dépôt présent. */
  git_branch?: string | null;
  /** `true` si `git status --porcelain` est vide. */
  git_worktree_clean?: boolean | null;
  /** Lignes `git status --porcelain` (codes + chemin), renvoyées par le daemon (plafonnées). */
  git_worktree_lines?: { status: string; path: string }[];
};

export async function listProjects(): Promise<StudioProject[]> {
  const r = await fetch(api("/api/studio/projects"));
  if (!r.ok) throw new Error(`listProjects ${r.status}`);
  const j = (await r.json()) as { projects: StudioProject[] };
  return j.projects ?? [];
}

/** Patch project settings. Any subset of fields may be provided; `tech_stack: null` clears the stack. */
export async function patchProjectSettings(
  projectId: string,
  body: {
    name?: string;
    tech_stack?: string | null;
    verify_skip?: boolean;
    verify_argv?: string[] | null;
    verify_timeout_sec?: number | null;
    evolution_summary?: string | null;
    policy_notes?: string | null;
  },
): Promise<void> {
  const r = await fetch(api(`/api/studio/projects/${projectId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`patchProjectSettings ${r.status}: ${t}`);
  }
}

export async function createProject(opts?: {
  name?: string;
  tech_stack?: string;
}): Promise<{ id: string; path: string }> {
  const r = await fetch(api("/api/studio/projects"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts && (opts.name || opts.tech_stack) ? { ...opts } : {}),
  });
  if (!r.ok) throw new Error(`createProject ${r.status}`);
  return r.json() as Promise<{ id: string; path: string }>;
}

export async function getProjectMeta(projectId: string): Promise<StudioProjectMeta> {
  const r = await fetch(api(`/api/studio/projects/${projectId}`));
  if (!r.ok) throw new Error(`getProjectMeta ${r.status}`);
  return r.json() as Promise<StudioProjectMeta>;
}

export async function getCodeRagStatus(projectId: string): Promise<CodeRagStatus> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/code-rag/status`));
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`getCodeRagStatus ${r.status}: ${t}`);
  }
  return r.json() as Promise<CodeRagStatus>;
}

/** Reconstruit / synchronise l’index code-RAG (force=true = rebuild complet ; false = reuse des fichiers inchangés). */
export async function reindexCodeRag(projectId: string, force = true): Promise<CodeRagStatus> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/code-rag/reindex`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`reindexCodeRag ${r.status}: ${t}`);
  }
  return r.json() as Promise<CodeRagStatus>;
}

export async function listFiles(projectId: string): Promise<string[]> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/files`));
  if (!r.ok) throw new Error(`listFiles ${r.status}`);
  const j = (await r.json()) as { files: string[] };
  return j.files ?? [];
}

export type StudioPreviewStartResponse = {
  ok: boolean;
  url: string;
  port: number;
  installed?: boolean;
  install?: { exit_code: number | null; stdout?: string; stderr?: string };
};

/** Lance `npm install` si besoin puis `npm run dev` (serveur en arrière-plan sur le daemon). */
export async function startStudioPreview(
  projectId: string,
  body?: { force_install?: boolean; port?: number },
): Promise<StudioPreviewStartResponse> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/preview/start`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`startStudioPreview ${r.status}: ${t}`);
  }
  return r.json() as Promise<StudioPreviewStartResponse>;
}

export async function stopStudioPreview(projectId: string): Promise<void> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/preview/stop`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok) throw new Error(`stopStudioPreview ${r.status}`);
}

/** Logs stdout/stderr du serveur `npm run dev` (tampon côté daemon). */
export async function getPreviewLogs(projectId: string): Promise<{
  running: boolean;
  log: string;
  preview_inactive?: boolean;
}> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/preview/logs`));
  if (!r.ok) throw new Error(`getPreviewLogs ${r.status}`);
  return r.json() as Promise<{ running: boolean; log: string; preview_inactive?: boolean }>;
}

/** `npm install` uniquement (sans lancer le serveur de dev). */
export async function installStudioDeps(
  projectId: string,
  opts?: { force?: boolean },
): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  install?: { exit_code: number | null; stdout?: string; stderr?: string };
}> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/preview/install`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force: opts?.force ?? false }),
  });
  const contentType = r.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    const j = (await r.json()) as {
      ok: boolean;
      skipped?: boolean;
      reason?: string;
      install?: { exit_code: number | null; stdout?: string; stderr?: string };
    };
    if (!r.ok && !j.install) {
      throw new Error(`installStudioDeps ${r.status}`);
    }
    return j;
  }

  const text = await r.text();
  if (!r.ok) {
    throw new Error(`installStudioDeps ${r.status}${text ? `: ${text}` : ""}`);
  }

  throw new Error(`installStudioDeps ${r.status}: expected JSON response`);
}

export async function validateDesignDoc(
  projectId: string,
  content?: string,
): Promise<{
  findings: { severity: string; path: string; message: string }[];
  summary: { errors: number; warnings: number; info: number };
}> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/design/validate`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content != null ? { content } : {}),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`validateDesignDoc ${r.status}: ${t}`);
  }
  return r.json() as Promise<{
    findings: { severity: string; path: string; message: string }[];
    summary: { errors: number; warnings: number; info: number };
  }>;
}

export async function readRawFile(
  projectId: string,
  path: string,
): Promise<{ content?: string; content_base64?: string; mime: string; path: string }> {
  const q = new URLSearchParams({ path });
  const r = await fetch(api(`/api/studio/projects/${projectId}/raw?${q}`));
  if (!r.ok) throw new Error(`readRawFile ${r.status}`);
  return r.json() as Promise<{
    content?: string;
    content_base64?: string;
    mime: string;
    path: string;
  }>;
}

/** Écrit le fichier texte sous le projet studio (UTF-8). Crée les répertoires parents si besoin. */
export async function writeRawFile(projectId: string, path: string, content: string): Promise<void> {
  const q = new URLSearchParams({ path });
  const r = await fetch(api(`/api/studio/projects/${projectId}/raw?${q}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`writeRawFile ${r.status}: ${t}`);
  }
}

/** Supprime un fichier du projet (fichier uniquement, pas un répertoire). */
export async function deleteRawFile(projectId: string, path: string): Promise<void> {
  const q = new URLSearchParams({ path });
  const r = await fetch(api(`/api/studio/projects/${projectId}/raw?${q}`), {
    method: "DELETE",
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`deleteRawFile ${r.status}: ${t}`);
  }
}

/** Renomme ou déplace un fichier ou un répertoire sous le projet (chemins relatifs, `/`). */
export async function renameStudioPath(projectId: string, from: string, to: string): Promise<void> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/fs/rename`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`renameStudioPath ${r.status}: ${t}`);
  }
}

export async function gitClone(projectId: string, repoUrl: string, branch?: string): Promise<void> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/git/clone`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_url: repoUrl, ...(branch ? { branch } : {}) }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`gitClone ${r.status}: ${t}`);
  }
}

export async function runBuild(
  projectId: string,
  argv: string[],
  timeoutSec?: number,
): Promise<{ exit_code: number | null; stdout?: string; stderr?: string; error?: string }> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/build`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ argv, timeout_sec: timeoutSec ?? 600 }),
  });
  if (!r.ok) throw new Error(`runBuild ${r.status}`);
  return r.json() as Promise<{
    exit_code: number | null;
    stdout?: string;
    stderr?: string;
    error?: string;
  }>;
}

export async function listEvolutions(projectId: string): Promise<Evolution[]> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/evolutions`));
  if (!r.ok) throw new Error(`listEvolutions ${r.status}`);
  const j = (await r.json()) as { evolutions: Evolution[] };
  return j.evolutions ?? [];
}

export async function createEvolution(projectId: string, label?: string): Promise<{ evolution_id: string; branch: string }> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/evolutions`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(label ? { label } : {}),
  });
  if (!r.ok) throw new Error(`createEvolution ${r.status}`);
  return r.json() as Promise<{ evolution_id: string; branch: string }>;
}

export async function mergeEvolution(
  projectId: string,
  evolutionId: string,
  opts?: { design_check?: boolean },
): Promise<void> {
  const r = await fetch(
    api(`/api/studio/projects/${projectId}/evolutions/${evolutionId}/merge`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design_check: opts?.design_check ?? false }),
    },
  );
  if (!r.ok) throw new Error(`mergeEvolution ${r.status}`);
}

export async function abandonEvolution(projectId: string, evolutionId: string): Promise<void> {
  const r = await fetch(
    api(`/api/studio/projects/${projectId}/evolutions/${evolutionId}/abandon`),
    { method: "POST" },
  );
  if (!r.ok) throw new Error(`abandonEvolution ${r.status}`);
}

/** Mode Code Studio injecté dans le message (daemon). */
export type StudioCodeMode = "plan" | "implement" | "build" | "free";

export async function sendMessage(body: {
  message: string;
  session_id?: string;
  studio_project_id?: string;
  studio_assigned_agent?: string;
  studio_evolution_branch?: string;
  studio_evolution_id?: string;
  studio_code_mode?: StudioCodeMode;
  /** Consigne ponctuelle pour cette requête uniquement. */
  studio_policy_hint?: string;
  /** Préfixe daemon : éviter sous-agents / délégations implicites. */
  studio_delegate_single_level?: boolean;
  /** Résumé design compact (tokens / intent). */
  studio_design_hint?: string;
  /** Contrat design complet (DESIGN.md), borné côté serveur. */
  studio_design_doc?: string;
}): Promise<{ task_id: string }> {
  const r = await fetch(api("/api/message"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: body.session_id ?? "code-studio",
      message: body.message,
      ...(body.studio_project_id ? { studio_project_id: body.studio_project_id } : {}),
      ...(body.studio_assigned_agent ? { studio_assigned_agent: body.studio_assigned_agent } : {}),
      ...(body.studio_evolution_branch ? { studio_evolution_branch: body.studio_evolution_branch } : {}),
      ...(body.studio_evolution_id ? { studio_evolution_id: body.studio_evolution_id } : {}),
      ...(body.studio_code_mode && body.studio_code_mode !== "free"
        ? { studio_code_mode: body.studio_code_mode }
        : {}),
      ...(body.studio_policy_hint?.trim() ? { studio_policy_hint: body.studio_policy_hint.trim() } : {}),
      ...(body.studio_delegate_single_level ? { studio_delegate_single_level: true } : {}),
      ...(body.studio_design_hint?.trim() ? { studio_design_hint: body.studio_design_hint.trim() } : {}),
      ...(body.studio_design_doc?.trim() ? { studio_design_doc: body.studio_design_doc } : {}),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`sendMessage ${r.status}: ${t}`);
  }
  const j = (await r.json()) as { task_id: string };
  return j;
}

/** Suggestion « prochaine action » (Code Studio + daemon). */
export type TaskSuggestedAction = {
  id: string;
  label: string;
  kind: "message" | "ui";
  message?: string;
  ui_action?: string;
};

export type TaskStatusResponse = {
  task_id: string;
  status: string;
  assigned_agent?: string;
  progress?: { progress_pct: number; message: string; task_id?: string | null }[];
  /** Dernière progression utile pour failed/cancelled (API daemon, rétrocompatible). */
  failure_detail?: string | null;
  suggested_actions?: TaskSuggestedAction[];
};

export async function getTask(taskId: string): Promise<TaskStatusResponse> {
  const r = await fetch(api(`/api/tasks/${taskId}`));
  if (!r.ok) throw new Error(`getTask ${r.status}`);
  return r.json() as Promise<TaskStatusResponse>;
}

/** Une entrée de diff fichier ↔ snapshot de début de tâche Code Studio. */
export type StudioDiffFileEntry = {
  path: string;
  status: string;
  diff: string;
  truncated: boolean;
};

export type TaskStudioDiffPayload = {
  task_id: string;
  captured_at: string;
  files: StudioDiffFileEntry[];
};

/** Diff texte depuis le snapshot de tâche ; `null` si pas de snapshot (404). */
export async function getTaskStudioDiff(taskId: string): Promise<TaskStudioDiffPayload | null> {
  const r = await fetch(api(`/api/tasks/${taskId}/studio-diff`));
  if (r.status === 404) return null;
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`getTaskStudioDiff ${r.status}: ${t}`);
  }
  return r.json() as Promise<TaskStudioDiffPayload>;
}

export type TaskEventEntry = {
  event_type: string;
  at: string;
  task_id?: string | null;
  payload?: unknown;
};

export async function getTaskEvents(taskId: string): Promise<TaskEventEntry[]> {
  const r = await fetch(api(`/api/tasks/${taskId}/events`));
  if (!r.ok) throw new Error(`getTaskEvents ${r.status}`);
  const j = (await r.json()) as { events?: TaskEventEntry[] };
  return j.events ?? [];
}

/** Question en attente (`ask_user`, approbation d’outil, etc.) — 404 si aucune. */
export type TaskHumanInputPayload = {
  task_id: string;
  question: string;
  context: string;
  choices: string[] | null;
};

export async function getTaskHumanInput(taskId: string): Promise<TaskHumanInputPayload | null> {
  const r = await fetch(api(`/api/tasks/${taskId}/human-input`));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`getTaskHumanInput ${r.status}`);
  return r.json() as Promise<TaskHumanInputPayload>;
}

/** Toutes les tâches en attente de réponse utilisateur (rechargement / file). */
export async function listPendingHumanInput(): Promise<TaskHumanInputPayload[]> {
  const r = await fetch(api("/api/pending-human-input"));
  if (!r.ok) throw new Error(`listPendingHumanInput ${r.status}`);
  const j = (await r.json()) as { pending: TaskHumanInputPayload[] };
  return j.pending ?? [];
}

export async function postTaskHumanReply(taskId: string, response: string): Promise<void> {
  const r = await fetch(api(`/api/tasks/${taskId}/human-reply`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`postTaskHumanReply ${r.status}: ${t}`);
  }
}

export function isTaskTerminal(status: string): boolean {
  return ["completed", "failed", "cancelled", "interrupted"].includes(status);
}

export function isTaskNeedsUser(status: string): boolean {
  return status === "waiting_user_input";
}

/** --- Hermes / operator cockpit (daemon HTTP) --- */

export async function fetchSchedulesPayload(): Promise<unknown> {
  const r = await fetch(api("/api/schedules"));
  if (!r.ok) throw new Error(`GET /api/schedules → ${r.status}`);
  return r.json();
}

export async function fetchTaskRunsPayload(): Promise<unknown> {
  const r = await fetch(api("/api/task_runs"));
  if (!r.ok) throw new Error(`GET /api/task_runs → ${r.status}`);
  return r.json();
}

export async function fetchProcessWatchRecent(limit = 20): Promise<unknown> {
  const r = await fetch(api(`/api/process/watch/recent?limit=${encodeURIComponent(String(limit))}`));
  if (!r.ok) throw new Error(`GET /api/process/watch/recent → ${r.status}`);
  return r.json();
}

export async function fetchTerminalCapabilities(): Promise<unknown> {
  const r = await fetch(api("/api/terminal/capabilities"));
  if (!r.ok) throw new Error(`GET /api/terminal/capabilities → ${r.status}`);
  return r.json();
}

export async function fetchToolsEffective(): Promise<unknown> {
  const r = await fetch(api("/api/tools/effective"));
  if (!r.ok) throw new Error(`GET /api/tools/effective → ${r.status}`);
  return r.json();
}
