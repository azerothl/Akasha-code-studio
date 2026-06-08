import type * as api from "./api";
import { Button } from "./components/ui/button";

// Helper to check if project is StudioProjectMeta
function isMeta(project: api.StudioProject | api.StudioProjectMeta): project is api.StudioProjectMeta {
  return "created_at" in project;
}

type Props = {
  project: api.StudioProject | api.StudioProjectMeta | null;
  codeRagStatus?: api.CodeRagStatus;
  activeTask?: { taskId: string; startedAt: number } | null;
  lastActivity?: {
    type: "design" | "plan" | "build" | "files";
    label: string;
    time: string;
  }[];
  lastSyncedAt?: number | null;
  onStartAgent?: () => void;
  onOpenKanban?: () => void;
  onOpenPlan?: () => void;
  onOpenDesign?: () => void;
  onOpenBranches?: () => void;
  onOpenPreview?: () => void;
};

function formatGitStatus(clean: boolean | null | undefined, lines?: { status: string; path: string }[]): string {
  if (clean === null || clean === undefined) return "Indéterminé";
  if (clean) return "✅ Propre";
  if (lines && lines.length > 0) {
    return `⚠️ ${lines.length} fichier(s) modifié(s)`;
  }
  return "⚠️ Modifications détectées";
}

function formatCodeRagStatus(status?: api.CodeRagStatus): string {
  if (!status) return "Index indisponible";
  switch (status.status) {
    case "absent":
      return "📦 Pas d'index";
    case "stale":
      return "🔄 Index obsolète";
    case "ready":
      return `✅ Index prêt (${status.files_indexed} fichiers, ${status.chunks_indexed} chunks)`;
    default:
      return "?";
  }
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

function timeSinceInMinutes(time: string): string {
  try {
    const date = new Date(time);
    if (isNaN(date.getTime())) return "?";
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000 / 60;
    if (diff < 1) return "À l'instant";
    if (diff < MINUTES_PER_HOUR) return `il y a ${Math.floor(diff)} min`;
    if (diff < MINUTES_PER_DAY) return `il y a ${Math.floor(diff / MINUTES_PER_HOUR)} h`;
    return `il y a ${Math.floor(diff / MINUTES_PER_DAY)} j`;
  } catch {
    return "?";
  }
}

export function ProjectDashboard({
  project,
  codeRagStatus,
  activeTask,
  lastActivity,
  lastSyncedAt,
  onStartAgent,
  onOpenKanban,
  onOpenPlan,
  onOpenDesign,
  onOpenBranches,
  onOpenPreview,
}: Props) {
  if (!project) {
    return (
      <div className="project-dashboard project-dashboard--empty">
        <div className="dashboard-empty-state">
          <div className="dashboard-empty-icon">📁</div>
          <h3>Aucun projet chargé</h3>
          <p className="hint">
            Créez un nouveau projet ou chargez un projet existant depuis le menu « Projet » en haut à gauche.
          </p>
        </div>
      </div>
    );
  }

  const meta = isMeta(project) ? project : null;
  
  const gitStatus = meta ? formatGitStatus(meta.git_worktree_clean, meta.git_worktree_lines) : "Données manquantes";
  const ragStatus = formatCodeRagStatus(codeRagStatus);

  return (
    <div className="project-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-block">
          <h2 className="dashboard-project-name">{project.name}</h2>
          <code className="dashboard-project-id" title={project.id}>
            {project.id.slice(0, 8)}…{project.id.slice(-4)}
          </code>
          <p className="hint" title="Rafraîchissement automatique des données du dashboard toutes les 10 secondes">
            {lastSyncedAt ? `Dernière synchro: ${timeSinceInMinutes(new Date(lastSyncedAt).toISOString())}` : "Dernière synchro: —"}
          </p>
        </div>
      </div>

      {/* Main content grid */}
      <div className="dashboard-grid">
        {/* Stack */}
        <div className="dashboard-card dashboard-card--stack">
          <div className="dashboard-card-header">
            <h3>Stack technique</h3>
          </div>
          <div className="dashboard-card-body">
            {meta?.tech_stack ? (
              <div className="dashboard-stack-text">
                <p className="hint">{meta.tech_stack}</p>
              </div>
            ) : (
              <p className="hint dashboard-hint-muted">Aucune stack définie. À configurer dans les paramètres.</p>
            )}
          </div>
        </div>

        {/* Git Status */}
        <div className="dashboard-card dashboard-card--git">
          <div className="dashboard-card-header">
            <h3>État Git</h3>
          </div>
          <div className="dashboard-card-body">
            <div className="dashboard-git-info">
              <div className="dashboard-git-item">
                <span className="label">Branche</span>
                <code className="value">{meta?.git_branch || "—"}</code>
              </div>
              <div className="dashboard-git-item">
                <span className="label">Statut</span>
                <span className="value">{gitStatus}</span>
              </div>
              {meta?.git_worktree_lines && meta.git_worktree_lines.length > 0 && (
                <div className="dashboard-git-files">
                  <span className="label">Fichiers modifiés :</span>
                  <ul className="dashboard-file-list">
                    {meta.git_worktree_lines.slice(0, 5).map((line: { status: string; path: string }, i: number) => (
                      <li key={i} title={`${line.status} ${line.path}`}>
                        <code>{line.status}</code> {line.path}
                      </li>
                    ))}
                    {meta.git_worktree_lines.length > 5 && (
                      <li className="hint">+{meta.git_worktree_lines.length - 5} autres…</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code RAG Index */}
        <div className="dashboard-card dashboard-card--rag">
          <div className="dashboard-card-header">
            <h3>Index Code</h3>
          </div>
          <div className="dashboard-card-body">
            <p className="hint">{ragStatus}</p>
            {codeRagStatus?.status === "ready" && codeRagStatus.built_at && (
              <p className="hint dashboard-hint-secondary">Mis à jour {timeSinceInMinutes(codeRagStatus.built_at)}</p>
            )}
          </div>
        </div>

        {/* Active Task */}
        {activeTask && (
          <div className="dashboard-card dashboard-card--task">
            <div className="dashboard-card-header">
              <h3>Tâche en cours</h3>
            </div>
            <div className="dashboard-card-body">
              <div className="dashboard-task-info">
                <p className="dashboard-task-id">
                  <code>{activeTask.taskId.slice(0, 12)}…</code>
                </p>
                <p className="hint">Démarrée {timeSinceInMinutes(new Date(activeTask.startedAt).toISOString())}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions Rapides */}
        <div className="dashboard-card dashboard-card--actions">
          <div className="dashboard-card-header">
            <h3>Actions rapides</h3>
          </div>
          <div className="dashboard-card-body dashboard-actions">
            <Button
              className="w-full justify-center text-[0.85rem]"
              onClick={onStartAgent}
              disabled={!onStartAgent}
              title="Ouvrir le focus sur le chat pour démarrer une nouvelle consigne agent"
              variant="default"
              size="sm"
            >
              🚀 Démarrer agent
            </Button>
            <Button
              className="w-full justify-center text-[0.85rem]"
              onClick={onOpenKanban}
              disabled={!onOpenKanban}
              title="Aller à l’onglet Kanban tickets"
              variant="secondary"
              size="sm"
            >
              🗂️ Ouvrir Kanban
            </Button>
            <Button
              className="w-full justify-center text-[0.85rem]"
              onClick={onOpenPlan}
              disabled={!onOpenPlan}
              title="Aller à l’onglet Plan (CODE_STUDIO_PLAN.md)"
              variant="secondary"
              size="sm"
            >
              📋 Voir plan
            </Button>
            <Button
              className="w-full justify-center text-[0.85rem]"
              onClick={onOpenDesign}
              disabled={!onOpenDesign}
              title="Aller à l’onglet Design (DESIGN.md)"
              variant="secondary"
              size="sm"
            >
              🎨 Voir design
            </Button>
            <Button
              className="w-full justify-center text-[0.85rem]"
              onClick={onOpenPreview}
              disabled={!onOpenPreview}
              title="Aller à l’onglet Aperçu / serveur dev"
              variant="secondary"
              size="sm"
            >
              👁️ Ouvrir aperçu
            </Button>
            <Button
              className="w-full justify-center text-[0.85rem]"
              onClick={onOpenBranches}
              disabled={!onOpenBranches}
              title="Aller à l’onglet Branches"
              variant={meta?.git_worktree_clean === false ? "default" : "secondary"}
              size="sm"
            >
              🌿 Ouvrir branches
            </Button>
          </div>
        </div>

        {/* Dernière activité */}
        {lastActivity && lastActivity.length > 0 && (
          <div className="dashboard-card dashboard-card--activity">
            <div className="dashboard-card-header">
              <h3>Dernière activité</h3>
            </div>
            <div className="dashboard-card-body">
              <ul className="dashboard-activity-list">
                {lastActivity.slice(0, 5).map((item, i) => (
                  <li key={i} className="dashboard-activity-item">
                    <span className="activity-icon">{item.type === "design" ? "🎨" : item.type === "plan" ? "📋" : item.type === "build" ? "🔨" : "📄"}</span>
                    <span className="activity-label">{item.label}</span>
                    <span className="activity-time">{item.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
