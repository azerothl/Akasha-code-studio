import { useState } from "react";
import * as api from "./api";
import { Button } from "./components/ui/button";
import { ChatStudioDiffPanel } from "./chatStudioDiff";
import type { TaskStudioDiffPayload } from "./api";
import { classifyReviewChecks, type ReviewCheckState } from "./taskReviewModel";

function checkStateLabel(state: ReviewCheckState): string {
  switch (state) {
    case "executed":
      return "exécuté";
    case "not_run":
      return "non lancé";
    case "manual":
      return "manuel";
    case "failed":
      return "échec";
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

type Props = {
  diff: TaskStudioDiffPayload;
  projectId: string | null;
  gitBranch: string | null;
  buildLog: string;
  onApplied?: () => void;
  onOpenEditor: (path: string) => void;
  onOpenPreview: () => void;
  onOpenBranches: () => void;
};

export function TaskReviewPanel({
  diff,
  projectId,
  gitBranch,
  buildLog,
  onApplied,
  onOpenEditor,
  onOpenPreview,
  onOpenBranches,
}: Props) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      const task = await api.getTask(diff.task_id);
      setStatus(task.status);
      setProgress((task.progress ?? []).map((row) => row.message));
      setMissing(task.acceptance_review?.missing ?? []);
    } catch (error) {
      setLoadError(String(error));
    }
  };

  const checks = classifyReviewChecks({ progress, missingManual: missing, buildLog });

  return (
    <section className="task-review" aria-label="Revue des changements">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
      >
        Revue de la tâche {open ? "— masquer" : "— afficher"}
      </Button>
      {open ? (
        <div className="task-review-body">
          <p className="hint">
            Branche Git : {gitBranch || "inconnue"}
            {status ? ` · statut ${status}` : ""}
          </p>
          <p className="hint">
            Le dry-run ne modifie pas les fichiers. Appliquer écrit uniquement les hunks cochés. Une seconde application des mêmes hunks est bloquée.
          </p>
          <div className="task-review-actions">
            <Button type="button" size="sm" variant="ghost" onClick={() => onOpenEditor(diff.files[0]?.path ?? "")}>
              Ouvrir l’éditeur
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onOpenPreview}>
              Ouvrir l’aperçu
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onOpenBranches}>
              Ouvrir les branches
            </Button>
          </div>
          {loadError ? <p className="hint">{loadError}</p> : null}
          <ul className="task-review-checks">
            {checks.map((check, index) => (
              <li key={`${check.label}-${index}`}>
                <strong>{check.label}</strong> · {checkStateLabel(check.state)} — {check.detail}
              </li>
            ))}
          </ul>
          <ChatStudioDiffPanel diff={diff} projectId={projectId} onApplied={onApplied} />
        </div>
      ) : null}
    </section>
  );
}
