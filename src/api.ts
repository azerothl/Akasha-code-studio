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
  proxy_signed?: boolean;
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
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`createEvolution ${r.status}${t ? `: ${t}` : ""}`);
  }
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

export type StudioAcceptanceCriterion = {
  id?: string;
  text: string;
  kind: "manual" | "file_exists" | "command_ok";
  path?: string;
  argv?: string[];
};

export type StudioAcceptancePayload = { criteria: StudioAcceptanceCriterion[] };

/** Texte libre (critères manuels) ou JSON `{ "criteria": [...] }` / tableau de critères. */
export function parseStudioAcceptanceCriteriaInput(
  raw: string,
): string | StudioAcceptancePayload | StudioAcceptanceCriterion[] | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.parse(t) as StudioAcceptancePayload | StudioAcceptanceCriterion[];
    } catch {
      return t;
    }
  }
  return t;
}

export async function sendMessage(body: {
  message: string;
  session_id?: string;
  message_delivery_mode?: "immediate" | "steering" | "follow_up";
  studio_project_id?: string;
  studio_assigned_agent?: string;
  studio_evolution_branch?: string;
  studio_evolution_id?: string;
  fork_from_task_id?: string;
  fork_after_message_index?: number;
  studio_code_mode?: StudioCodeMode;
  /** Consigne ponctuelle pour cette requête uniquement. */
  studio_policy_hint?: string;
  /** Préfixe daemon : éviter sous-agents / délégations implicites. */
  studio_delegate_single_level?: boolean;
  /** Résumé design compact (tokens / intent). */
  studio_design_hint?: string;
  /** Contrat design complet (DESIGN.md), borné côté serveur. */
  studio_design_doc?: string;
  /** Definition of Done : texte ou critères structurés (voir spec daemon). */
  studio_acceptance_criteria?: string | StudioAcceptancePayload | StudioAcceptanceCriterion[];
}): Promise<{ task_id: string }> {
  const r = await fetch(api("/api/message"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: body.session_id ?? "code-studio",
      message: body.message,
      ...(body.message_delivery_mode ? { message_delivery_mode: body.message_delivery_mode } : {}),
      ...(body.studio_project_id ? { studio_project_id: body.studio_project_id } : {}),
      ...(body.studio_assigned_agent ? { studio_assigned_agent: body.studio_assigned_agent } : {}),
      ...(body.studio_evolution_branch ? { studio_evolution_branch: body.studio_evolution_branch } : {}),
      ...(body.studio_evolution_id ? { studio_evolution_id: body.studio_evolution_id } : {}),
      ...(body.fork_from_task_id ? { fork_from_task_id: body.fork_from_task_id } : {}),
      ...(Number.isFinite(body.fork_after_message_index)
        ? { fork_after_message_index: body.fork_after_message_index }
        : {}),
      ...(body.studio_code_mode && body.studio_code_mode !== "free"
        ? { studio_code_mode: body.studio_code_mode }
        : {}),
      ...(body.studio_policy_hint?.trim() ? { studio_policy_hint: body.studio_policy_hint.trim() } : {}),
      ...(body.studio_delegate_single_level ? { studio_delegate_single_level: true } : {}),
      ...(body.studio_design_hint?.trim() ? { studio_design_hint: body.studio_design_hint.trim() } : {}),
      ...(body.studio_design_doc?.trim() ? { studio_design_doc: body.studio_design_doc } : {}),
      ...(body.studio_acceptance_criteria !== undefined && body.studio_acceptance_criteria !== null
        ? { studio_acceptance_criteria: body.studio_acceptance_criteria }
        : {}),
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
  tokens_used?: number;
  cost_usd?: number;
  last_turn_tokens_in?: number;
  last_turn_tokens_out?: number;
  last_turn_cost_usd?: number;
  /** Dernière progression utile pour failed/cancelled (API daemon, rétrocompatible). */
  failure_detail?: string | null;
  /** Revue critères post-tâche (optionnel, tâche terminée avec points manuels signalés). */
  acceptance_review?: { missing?: string[] } | null;
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

export async function applyStudioPatchHunks(
  projectId: string,
  body: { patches: string[]; dry_run?: boolean },
): Promise<{ ok: boolean; dry_run: boolean; requested: number; applied: number; errors: string[] }> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/patch/hunks`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await r.json()) as { ok: boolean; dry_run: boolean; requested: number; applied: number; errors?: string[] };
  return {
    ok: payload.ok,
    dry_run: payload.dry_run,
    requested: payload.requested,
    applied: payload.applied,
    errors: payload.errors ?? [],
  };
}

export type TaskEventEntry = {
  schema_version?: number;
  kind?: string;
  event_type: string;
  at: string;
  task_id?: string | null;
  payload?: unknown;
};

export async function getTaskEvents(taskId: string): Promise<TaskEventEntry[]> {
  const r = await fetch(api(`/api/tasks/${taskId}/events`));
  if (!r.ok) throw new Error(`getTaskEvents ${r.status}`);
  const j = (await r.json()) as { events?: TaskEventEntry[] };
  return (j.events ?? []).map((ev) => ({
    ...ev,
    event_type: ev.event_type || ev.kind || "unknown",
    kind: ev.kind || ev.event_type || "unknown",
  }));
}

export type TaskEventsLiveSubscription = {
  close: () => void;
  mode: "sse" | "polling";
};

function asLiveEventRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Live task events stream:
 * - preferred: SSE over `/api/events` (global bus, filtered by `correlation_id`)
 * - fallback: polling `GET /api/tasks/:id/events`
 */
export function subscribeTaskEventsLive(
  taskId: string,
  onSnapshot: (events: TaskEventEntry[]) => void,
  opts?: { pollIntervalMs?: number; preferSse?: boolean },
): TaskEventsLiveSubscription {
  const pollIntervalMs = Math.max(800, opts?.pollIntervalMs ?? 2000);
  const preferSse = opts?.preferSse ?? true;
  let closed = false;
  let timer: number | null = null;
  let es: EventSource | null = null;
  let pollInFlight = false;

  const close = () => {
    closed = true;
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (es) {
      es.close();
      es = null;
    }
  };

  const startPolling = () => {
    const tick = async () => {
      if (closed || pollInFlight) return;
      pollInFlight = true;
      try {
        const rows = await getTaskEvents(taskId);
        if (!closed) onSnapshot(rows);
      } catch {
        // keep previous snapshot; next tick may recover
      } finally {
        pollInFlight = false;
        if (!closed) timer = window.setTimeout(() => void tick(), pollIntervalMs);
      }
    };
    void tick();
  };

  if (!preferSse || typeof window === "undefined" || typeof EventSource === "undefined") {
    startPolling();
    return { close, mode: "polling" };
  }

  try {
    const nextByKey = new Map<string, TaskEventEntry>();
    es = new EventSource(api("/api/events"));
    es.onmessage = (ev) => {
      if (closed) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      const o = asLiveEventRecord(parsed);
      const correlationId = typeof o?.correlation_id === "string" ? o.correlation_id : "";
      if (correlationId !== taskId) return;
      const at = typeof o?.timestamp === "string" ? o.timestamp : new Date().toISOString();
      const eventType = typeof o?.event_type === "string" ? o.event_type : "unknown";
      const key = `${eventType}\0${at}\0${typeof o?.id === "string" ? o.id : ""}`;
      nextByKey.set(key, {
        schema_version: 1,
        kind: eventType,
        event_type: eventType,
        at,
        task_id: taskId,
        payload: o?.payload,
      });
      onSnapshot(
        Array.from(nextByKey.values()).sort((a, b) => a.at.localeCompare(b.at)),
      );
    };
    es.onerror = () => {
      if (closed) return;
      if (es) {
        es.close();
        es = null;
      }
      startPolling();
    };
    return { close, mode: "sse" };
  } catch {
    startPolling();
    return { close, mode: "polling" };
  }
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

export async function normalizeHttpError(method: string, path: string, r: Response): Promise<Error> {
  let details = "";
  try {
    const body = (await r.text()).trim();
    if (body) details = ` — ${body}`;
  } catch {
    // Ignore body read failures and fall back to status-only error details.
  }
  return new Error(`${method} ${path} → ${r.status}${details}`);
}

export async function fetchSchedulesPayload(): Promise<unknown> {
  const r = await fetch(api("/api/schedules"));
  if (!r.ok) throw await normalizeHttpError("GET", "/api/schedules", r);
  return r.json();
}

export async function fetchTaskRunsPayload(): Promise<unknown> {
  const r = await fetch(api("/api/task_runs"));
  if (!r.ok) throw await normalizeHttpError("GET", "/api/task_runs", r);
  return r.json();
}

export async function fetchProcessWatchRecent(limit = 20): Promise<unknown> {
  const r = await fetch(api(`/api/process/watch/recent?limit=${encodeURIComponent(String(limit))}`));
  if (!r.ok) throw await normalizeHttpError("GET", "/api/process/watch/recent", r);
  return r.json();
}

export async function fetchTerminalCapabilities(): Promise<unknown> {
  const r = await fetch(api("/api/terminal/capabilities"));
  if (!r.ok) throw await normalizeHttpError("GET", "/api/terminal/capabilities", r);
  return r.json();
}

export async function fetchToolsEffective(): Promise<unknown> {
  const r = await fetch(api("/api/tools/effective"));
  if (!r.ok) throw await normalizeHttpError("GET", "/api/tools/effective", r);
  return r.json();
}

export async function fetchMemoryRecallMetrics(): Promise<unknown> {
  const r = await fetch(api("/api/memory/recall-metrics"));
  if (!r.ok) throw await normalizeHttpError("GET", "/api/memory/recall-metrics", r);
  return r.json();
}

export async function fetchMcpStatus(): Promise<unknown> {
  const r = await fetch(api("/api/mcp/status"));
  if (!r.ok) throw await normalizeHttpError("GET", "/api/mcp/status", r);
  return r.json();
}

export async function fetchMcpRuntime(): Promise<unknown> {
  const r = await fetch(api("/api/mcp/runtime"));
  if (!r.ok) throw await normalizeHttpError("GET", "/api/mcp/runtime", r);
  return r.json();
}

export async function fetchLifecycleHooks(): Promise<unknown> {
  const r = await fetch(api("/api/lifecycle/hooks"));
  if (!r.ok) throw await normalizeHttpError("GET", "/api/lifecycle/hooks", r);
  return r.json();
}

export type DaemonStatus = {
  ok: boolean;
  label: string;
  detail?: string;
};

/** Lightweight daemon health probe for header badge. */
export async function fetchDaemonStatus(): Promise<DaemonStatus> {
  try {
    const r = await fetch(api("/api/status"));
    if (!r.ok) return { ok: false, label: "Hors ligne", detail: `HTTP ${r.status}` };
    const text = (await r.text()).trim();
    if (!text) return { ok: true, label: "En ligne" };
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      const status = typeof j.status === "string" ? j.status : "ok";
      const version = typeof j.version === "string" ? j.version : null;
      return { ok: true, label: "En ligne", detail: version ? `${status} · v${version}` : status };
    } catch {
      return { ok: true, label: "En ligne", detail: text.slice(0, 80) };
    }
  } catch (e) {
    return { ok: false, label: "Hors ligne", detail: String(e) };
  }
}

/** Pause / resume / run-now — `POST /api/schedules/{id}/{pause|resume|run_now}` (daemon Hermes parity). */
export async function postScheduleControl(
  scheduleId: string,
  action: "pause" | "resume" | "run_now",
): Promise<unknown> {
  const path = `/api/schedules/${encodeURIComponent(scheduleId)}/${action}`;
  const r = await fetch(api(path), { method: "POST" });
  if (!r.ok) throw await normalizeHttpError("POST", path, r);
  return r.json();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function asNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
}

export type OpsSchedule = { id: string; name: string; enabled: boolean };
export type OpsTaskRun = { id: string; task: string; status: string; startedAt: string; endedAt: string; summary: string };
export type OpsProcessEvent = { at: string; status: string; command: string; detail: string };
export type OpsTerminalSummary = { current: string; interactivePty: boolean; ptyApi: string[]; shells: string[] };
export type OpsToolsSummary = { profile: string; allow: number; deny: number; approval: number };
export type OpsMcpSummary = { configPresent: boolean; serverCount: number; runtime: string; oauthMode: string };
export type OpsLifecycleSummary = { present: boolean; timeoutSec: number; sandbox: string; phases: string[] };

export function parseSchedulesPayload(data: unknown): OpsSchedule[] {
  const o = asRecord(data);
  const rows = Array.isArray(o?.schedules) ? o?.schedules : [];
  const out: OpsSchedule[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    const id = asStr(r?.id);
    if (!id) continue;
    out.push({
      id,
      name: asStr(r?.name) ?? id,
      enabled: asBool(r?.enabled) ?? true,
    });
  }
  return out;
}

export function parseTaskRunsPayload(data: unknown): OpsTaskRun[] {
  const o = asRecord(data);
  const rows = Array.isArray(o?.task_runs) ? o?.task_runs : [];
  return rows
    .map((row) => {
      const r = asRecord(row);
      const id = asStr(r?.id) ?? asStr(r?.run_id) ?? "";
      if (!id) return null;
      return {
        id,
        task: asStr(r?.task_id) ?? asStr(r?.task_name) ?? "—",
        status: asStr(r?.status) ?? "unknown",
        startedAt: asStr(r?.started_at) ?? "—",
        endedAt: asStr(r?.ended_at) ?? "—",
        summary: asStr(r?.summary) ?? asStr(r?.message) ?? "",
      };
    })
    .filter((x): x is OpsTaskRun => Boolean(x));
}

export function parseProcessWatchPayload(data: unknown): OpsProcessEvent[] {
  const o = asRecord(data);
  const rows = Array.isArray(o?.events) ? o?.events : [];
  return rows
    .map((row) => {
      const r = asRecord(row);
      if (!r) return null;
      const exit = asNum(r.exit_code);
      return {
        at: asStr(r.at) ?? asStr(r.ended_at) ?? "—",
        status: exit == null ? "running" : exit === 0 ? "ok" : "error",
        command: asStr(r.command) ?? asStr(r.cmd) ?? "—",
        detail: exit == null ? "en cours" : `exit ${exit}`,
      };
    })
    .filter((x): x is OpsProcessEvent => Boolean(x));
}

export function parseTerminalCapabilitiesPayload(data: unknown): OpsTerminalSummary {
  const o = asRecord(data) ?? {};
  return {
    current: asStr(o.current) ?? "unknown",
    interactivePty: asBool(o.interactive_pty) ?? false,
    ptyApi: asStrArray(o.pty_api),
    shells: asStrArray(o.shells),
  };
}

export function parseToolsEffectivePayload(data: unknown): OpsToolsSummary {
  const o = asRecord(data) ?? {};
  const tools = Array.isArray(o.tools) ? o.tools : [];
  let allow = 0;
  let deny = 0;
  let approval = 0;
  for (const tool of tools) {
    const t = asRecord(tool);
    const p = asStr(t?.policy)?.toLowerCase() ?? "";
    if (p.includes("deny")) deny += 1;
    else if (p.includes("approval")) approval += 1;
    else allow += 1;
  }
  return {
    profile: asStr(o.profile) ?? asStr(o.active_profile) ?? "default",
    allow,
    deny,
    approval,
  };
}

export function parseMcpSummary(statusPayload: unknown, runtimePayload: unknown): OpsMcpSummary {
  const s = asRecord(statusPayload) ?? {};
  const r = asRecord(runtimePayload) ?? {};
  const oauth = asRecord(r.oauth);
  return {
    configPresent: asBool(s.config_present) ?? false,
    serverCount: asNum(s.server_count) ?? 0,
    runtime: asStr(s.runtime) ?? "unknown",
    oauthMode: asStr(oauth?.mode) ?? "unknown",
  };
}

export function parseLifecycleHooksPayload(data: unknown): OpsLifecycleSummary {
  const o = asRecord(data) ?? {};
  return {
    present: asBool(o.present) ?? false,
    timeoutSec: asNum(o.timeout_sec) ?? 0,
    sandbox: asStr(o.sandbox) ?? "none",
    phases: asStrArray(o.executed_phases),
  };
}
