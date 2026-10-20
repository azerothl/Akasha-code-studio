import { useEffect, useState } from "react";
import * as api from "./api";
import { Button } from "./components/ui/button";
import { ChatStudioDiffPanel } from "./chatStudioDiff";
import { AsyncState } from "./asyncState";
import { redactSecrets } from "./sendContext";
import { classifyReviewChecks, type ReviewCheckState } from "./taskReviewModel";
import { TaskOutcomeSummary } from "./taskOutcome";

const CHECK_LABEL: Record<ReviewCheckState, string> = {
  executed: "exécuté", not_run: "exécution non confirmée", manual: "manuel", failed: "échec",
};
type Props = {
  diff: api.TaskStudioDiffPayload;
  projectId: string | null;
  gitBranch: string | null;
  acceptanceCriteria?: string;
  buildLog: string;
  onApplied?: () => void;
  onOpenEditor: (path: string) => void;
  onOpenPreview: () => void;
  onOpenBranches: () => void;
};

export function TaskReviewPanel({ diff, projectId, gitBranch, acceptanceCriteria, buildLog, onApplied, onOpenEditor, onOpenPreview, onOpenBranches }: Props) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<api.TaskStatusResponse | null>(null);
  const [meta, setMeta] = useState<api.StudioProjectMeta | null>(null);
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setTask(null); setMeta(null); setConflicts(null);
    void Promise.allSettled([
      api.getTask(diff.task_id),
      projectId ? api.getProjectMeta(projectId) : Promise.resolve(null),
      projectId ? api.getGitConflicts(projectId) : Promise.resolve(null),
    ]).then(([taskResult, metaResult, conflictResult]) => {
      if (cancelled) return;
      const errors: string[] = [];
      if (taskResult.status === "fulfilled") setTask(taskResult.value); else errors.push(String(taskResult.reason));
      if (metaResult.status === "fulfilled") setMeta(metaResult.value); else errors.push(String(metaResult.reason));
      if (conflictResult.status === "fulfilled") setConflicts(conflictResult.value?.conflict_files ?? null); else errors.push(String(conflictResult.reason));
      if (errors.length) setLoadError(errors.join("\n"));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, diff.task_id, projectId, retry]);

  const checks = classifyReviewChecks({
    progress: (task?.progress ?? []).filter(row => !row.task_id || row.task_id === diff.task_id).map(row => row.message),
    missingManual: task?.acceptance_review?.missing ?? [],
    buildLog,
    outcome: task?.outcome,
  });
  return (
    <section className="task-review" aria-label="Revue des changements">
      <Button type="button" size="sm" variant="secondary" aria-expanded={open} onClick={() => { if (!open) setLoading(true); setOpen(value => !value); }}>
        Revue de la tâche {open ? "— masquer" : "— afficher"}
      </Button>
      {open ? <div className="task-review-body">
        <p className="hint">Branche de la tâche : {gitBranch || "non enregistrée"}{task ? ` · statut ${task.status}` : ""}</p>
        {task ? <TaskOutcomeSummary outcome={task.outcome} status={task.status} /> : null}
        <p className="hint">Branche actuelle : {meta?.git_branch || "indisponible"} · Arbre Git : {meta?.git_worktree_clean === true ? "propre" : meta?.git_worktree_clean === false ? "modifié" : "indisponible"} · Conflits : {conflicts ? conflicts.length ? conflicts.join(", ") : "aucun" : "indisponibles"}</p>
        <p className="hint">Les fichiers ont déjà été modifiés par l’agent. Le dry-run vérifie si une sélection peut être réappliquée ; appliquez-la uniquement à une copie qui ne contient pas ces changements.</p>
        <div className="task-review-actions">
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenEditor(diff.files[0]?.path ?? "")}>Ouvrir l’éditeur</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onOpenPreview}>Ouvrir l’aperçu</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onOpenBranches}>Ouvrir les branches</Button>
        </div>
        {loading ? <AsyncState kind="loading" title="Chargement des vérifications…" /> : null}
        {loadError ? <AsyncState kind="partial" title="Revue partielle" description="Le diff reste consultable ; certains contrôles sont indisponibles." detail={loadError} action={{ label: "Réessayer", onClick: () => setRetry(value => value + 1) }} /> : null}
        <h4>Critères envoyés avec la tâche</h4>
        {acceptanceCriteria?.trim() ? <pre className="build-pre">{redactSecrets(acceptanceCriteria)}</pre> : <p className="hint">Aucun critère enregistré pour cette tâche.</p>}
        <ul className="task-review-checks">{checks.map((check, index) => (
          <li key={`${check.label}-${index}`}><strong>{check.label}</strong> · {CHECK_LABEL[check.state]} — {check.detail}</li>
        ))}</ul>
        <ChatStudioDiffPanel key={diff.task_id} diff={diff} projectId={projectId} onApplied={onApplied} disabled={loading} />
      </div> : null}
    </section>
  );
}
