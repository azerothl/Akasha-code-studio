import type { StudioWorktreeRecord } from "./api";
import { Button } from "./components/ui/button";

type Props = {
  worktrees: StudioWorktreeRecord[];
  busy: boolean;
  notice: string | null;
  onRefresh: () => void;
  onIntegrate: (taskId: string) => void;
  onAbandon: (taskId: string) => void;
};

export function SwarmIsolationPanel({ worktrees, busy, notice, onRefresh, onIntegrate, onAbandon }: Props) {
  return (
    <section className="swarm-isolation" aria-label="Isolation des tâches parallèles">
      <div className="swarm-isolation-head">
        <h3>Isolation swarm</h3>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onRefresh}>
          Actualiser
        </Button>
      </div>
      <p className="hint">
        Unité d’isolation : une sous-tâche worker, quand <code>AKASHA_STUDIO_WORKTREE_ENABLED</code> est actif.
        Chaque worker reçoit une branche <code>wt/…</code> et la référence de départ de la branche de base.
        Les changements ne rejoignent le projet qu’après Intégrer. Abandonner retire le worktree.
        Le parallélisme reste borné par <code>AKASHA_STUDIO_MAX_PARALLEL_OPS</code>. Les états terminaux du registre mémoire sont purgés après 24 h ; une revue en attente reste jusqu’à une action explicite.
      </p>
      {notice ? <p className="hint">{notice}</p> : null}
      {worktrees.length === 0 ? (
        <p className="hint">Aucun worktree enregistré pour ce projet.</p>
      ) : (
        <ul className="swarm-isolation-list">
          {worktrees.map((row) => {
            const pending = row.lifecycle_state === "awaiting_review" || row.lifecycle_state === "needs_user_resolution" || row.lifecycle_state === "active";
            return (
              <li key={row.task_id} className="swarm-isolation-item">
                <p>
                  <code>{row.worktree_branch}</code> · {row.lifecycle_state}
                </p>
                <p className="hint">
                  Base {row.base_branch} @ {row.base_sha.slice(0, 8) || "—"}
                  {row.conflict_state ? ` · conflit ${row.conflict_state}` : ""}
                  {row.integration_status ? ` · ${row.integration_status}` : ""}
                </p>
                {pending ? (
                  <div className="task-review-actions">
                    <Button type="button" size="sm" disabled={busy} onClick={() => onIntegrate(row.task_id)}>
                      Intégrer
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => onAbandon(row.task_id)}>
                      Abandonner
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
