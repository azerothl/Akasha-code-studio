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

export type StudioProjectMeta = {
  id: string;
  name: string;
  created_at: string;
  evolutions?: Evolution[];
  tech_stack?: string | null;
};

export async function listProjects(): Promise<StudioProject[]> {
  const r = await fetch(api("/api/studio/projects"));
  if (!r.ok) throw new Error(`listProjects ${r.status}`);
  const j = (await r.json()) as { projects: StudioProject[] };
  return j.projects ?? [];
}

/** At least one of `name` or `tech_stack` must be set. Use `tech_stack: null` to clear the stack. */
export async function patchProjectSettings(
  projectId: string,
  body: { name?: string; tech_stack?: string | null },
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

export async function listFiles(projectId: string): Promise<string[]> {
  const r = await fetch(api(`/api/studio/projects/${projectId}/files`));
  if (!r.ok) throw new Error(`listFiles ${r.status}`);
  const j = (await r.json()) as { files: string[] };
  return j.files ?? [];
}

export async function readRawFile(
  projectId: string,
  path: string,
): Promise<{ content?: string; mime: string; path: string }> {
  const q = new URLSearchParams({ path });
  const r = await fetch(api(`/api/studio/projects/${projectId}/raw?${q}`));
  if (!r.ok) throw new Error(`readRawFile ${r.status}`);
  return r.json() as Promise<{ content?: string; mime: string; path: string }>;
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

export async function mergeEvolution(projectId: string, evolutionId: string): Promise<void> {
  const r = await fetch(
    api(`/api/studio/projects/${projectId}/evolutions/${evolutionId}/merge`),
    { method: "POST" },
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

export async function sendMessage(body: {
  message: string;
  session_id?: string;
  studio_project_id?: string;
  studio_assigned_agent?: string;
  studio_evolution_branch?: string;
  studio_evolution_id?: string;
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
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`sendMessage ${r.status}: ${t}`);
  }
  const j = (await r.json()) as { task_id: string };
  return j;
}

export type TaskStatusResponse = {
  task_id: string;
  status: string;
  assigned_agent?: string;
  progress?: { progress_pct: number; message: string }[];
};

export async function getTask(taskId: string): Promise<TaskStatusResponse> {
  const r = await fetch(api(`/api/tasks/${taskId}`));
  if (!r.ok) throw new Error(`getTask ${r.status}`);
  return r.json() as Promise<TaskStatusResponse>;
}

export function isTaskTerminal(status: string): boolean {
  return ["completed", "failed", "cancelled", "interrupted"].includes(status);
}

export function isTaskNeedsUser(status: string): boolean {
  return status === "waiting_user_input";
}
