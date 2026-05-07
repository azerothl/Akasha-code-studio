import { useEffect, useMemo, useState } from "react";
import * as api from "./api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Select } from "./components/ui/select";

const COLUMNS: { id: api.StudioTicketStatus; label: string; theme: string }[] = [
  { id: "todo", label: "Todo", theme: "slate" },
  { id: "in_progress", label: "In progress", theme: "blue" },
  { id: "review", label: "Review", theme: "amber" },
  { id: "done", label: "Done", theme: "green" },
  { id: "blocked", label: "Blocked", theme: "red" },
];

/** IDs prérequis fusionnés (liste + ancien champ singleton). */
function mergedTicketDependencyIds(ticket: api.StudioTicket): string[] {
  const set = new Set<string>();
  for (const id of ticket.depends_on_ticket_ids ?? []) {
    const x = id.trim();
    if (x) set.add(x);
  }
  const single = ticket.depends_on_ticket_id?.trim();
  if (single) set.add(single);
  return [...set].sort();
}

/** Tous les tickets prérequis doivent être en `done`. */
function ticketPrerequisiteSatisfied(ticket: api.StudioTicket, all: api.StudioTicket[]): boolean {
  const deps = mergedTicketDependencyIds(ticket);
  if (deps.length === 0) return true;
  for (const depId of deps) {
    const dep = all.find((x) => x.id === depId);
    if (dep?.status !== "done") return false;
  }
  return true;
}

function formatTaskStatusFr(status: string): string {
  const m: Record<string, string> = {
    pending: "En attente",
    queued: "En file",
    running: "En cours (LLM / outils)",
    completed: "Terminé",
    failed: "Échec",
    paused: "En pause",
    cancelled: "Annulé",
    waiting_user_input: "Attente de votre réponse",
    interrupted: "Interrompu",
  };
  return m[status] ?? status;
}

type KanbanBoardProps = {
  projectId: string | null;
  defaultAgent?: string;
  ticketEnforcementMode?: "off" | "soft" | "strict";
  onLaunchTicket: (ticket: api.StudioTicket) => void;
  /** Ouvre la modale « Détail de la tâche » (événements, progression, workflow). */
  onOpenTaskTracking?: (taskId: string) => void;
};

export function KanbanBoard({
  projectId,
  defaultAgent,
  ticketEnforcementMode,
  onLaunchTicket,
  onOpenTaskTracking,
}: KanbanBoardProps) {
  const [tickets, setTickets] = useState<api.StudioTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<api.StudioTicket | null>(null);
  const [timeline, setTimeline] = useState<api.StudioTicketEvent[]>([]);
  const [ticketDetailState, setTicketDetailState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [ticketDetailError, setTicketDetailError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [correctiveStepsRaw, setCorrectiveStepsRaw] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssignedAgent, setNewAssignedAgent] = useState(defaultAgent || "studio_fullstack");
  const [newReviewAgent, setNewReviewAgent] = useState("studio_reviewer");
  const [newCriteriaRaw, setNewCriteriaRaw] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [playBusyId, setPlayBusyId] = useState<string | null>(null);
  const [playAllBusy, setPlayAllBusy] = useState(false);
  const [playAllStatus, setPlayAllStatus] = useState<string | null>(null);
  const [linkedTaskSnapshot, setLinkedTaskSnapshot] = useState<api.TaskStatusResponse | null>(null);
  const [linkedTaskLoading, setLinkedTaskLoading] = useState(false);
  const [linkedTaskError, setLinkedTaskError] = useState<string | null>(null);
  const [newDependsOnIds, setNewDependsOnIds] = useState<string[]>([]);
  const [dependsOnDraftIds, setDependsOnDraftIds] = useState<string[]>([]);
  const [depPatchBusy, setDepPatchBusy] = useState(false);
  const [depPatchError, setDepPatchError] = useState<string | null>(null);
  const [recoverTicketBusy, setRecoverTicketBusy] = useState(false);
  const [taskCtlBusy, setTaskCtlBusy] = useState<"pause" | "resume" | "cancel" | null>(null);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await api.listStudioTickets(projectId);
      setTickets(items);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const id = window.setInterval(() => {
      void load();
      if (selected) {
        void openTicket(selected);
      }
    }, 5000);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selected?.id]);

  useEffect(() => {
    const taskId = selected?.related_task_id?.trim();
    if (!taskId) {
      setLinkedTaskSnapshot(null);
      setLinkedTaskError(null);
      setLinkedTaskLoading(false);
      return;
    }
    setLinkedTaskSnapshot(null);
    setLinkedTaskError(null);
    let cancelled = false;
    const refresh = async () => {
      try {
        const t = await api.tryGetTask(taskId);
        if (!cancelled) {
          if (t === null) {
            setLinkedTaskSnapshot(null);
            setLinkedTaskError(
              "Tâche introuvable (souvent après redémarrage du daemon ou perte du store local). Le ticket peut rester « en cours » par erreur.",
            );
          } else {
            setLinkedTaskSnapshot(t);
            setLinkedTaskError(null);
          }
          setLinkedTaskLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setLinkedTaskError(String(e));
          setLinkedTaskLoading(false);
        }
      }
    };
    setLinkedTaskLoading(true);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selected?.related_task_id]);

  useEffect(() => {
    if (!selected) return;
    setDependsOnDraftIds(mergedTicketDependencyIds(selected));
    setDepPatchError(null);
  }, [selected?.id, selected?.depends_on_ticket_id, selected?.depends_on_ticket_ids]);

  const byStatus = useMemo(() => {
    const map = new Map<api.StudioTicketStatus, api.StudioTicket[]>();
    for (const col of COLUMNS) map.set(col.id, []);
    for (const t of tickets) map.get(t.status)?.push(t);
    return map;
  }, [tickets]);

  const stuckExecutionHint = useMemo(() => {
    if (!selected?.related_task_id?.trim()) return null;
    if (selected.status !== "in_progress" && selected.status !== "review") return null;
    if (linkedTaskError) {
      return {
        tone: "warn" as const,
        text: linkedTaskError,
      };
    }
    const st = linkedTaskSnapshot?.status;
    if (!st) return null;
    if (st === "failed" || st === "cancelled" || st === "completed") {
      const text =
        st === "completed"
          ? "La tâche liée est terminée alors que le ticket est encore en cours ou en review. Débloquez le ticket pour réaligner le Kanban."
          : "La tâche liée est en état terminal (échec ou annulation). Débloquez le ticket si vous voulez relancer un Play."
      return { tone: "warn" as const, text };
    }
    if (st === "interrupted") {
      return {
        tone: "info" as const,
        text:
          "La tâche a été interrompue (ex. arrêt du daemon). Vous pouvez la reprendre ci-dessous ou débloquer le ticket pour un nouveau Play.",
      };
    }
    return null;
  }, [selected, linkedTaskError, linkedTaskSnapshot]);

  const canPauseLinked =
    !!linkedTaskSnapshot &&
    ["pending", "queued", "running", "waiting_user_input"].includes(linkedTaskSnapshot.status);
  const canResumeLinked =
    !!linkedTaskSnapshot &&
    ["paused", "interrupted", "failed"].includes(linkedTaskSnapshot.status);
  const canCancelLinked =
    !!linkedTaskSnapshot &&
    ["pending", "queued", "running"].includes(linkedTaskSnapshot.status);

  async function openTicket(ticket: api.StudioTicket) {
    if (!projectId) return;
    setSelected(ticket);
    setTicketDetailState("loading");
    setTicketDetailError(null);
    try {
      const payload = await api.getStudioTicket(projectId, ticket.id);
      setSelected(payload.ticket);
      setTimeline(payload.timeline);
      setTicketDetailState("ready");
    } catch (e) {
      setTimeline([]);
      setTicketDetailState("error");
      setTicketDetailError(String(e));
    }
  }

  async function createTicket() {
    if (!projectId) return;
    const title = newTitle.trim();
    if (!title) {
      setCreateError("Le titre est obligatoire.");
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      const acceptanceCriteria = newCriteriaRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({
          id: `ac-${index + 1}`,
          text: line,
          kind: "manual" as const,
        }));
      const created = await api.createStudioTicket(projectId, {
        title,
        description: newDesc.trim(),
        assigned_agent: newAssignedAgent.trim(),
        review_agent: newReviewAgent.trim(),
        acceptance_criteria: acceptanceCriteria.length ? acceptanceCriteria : undefined,
        ...(newDependsOnIds.length ? { depends_on_ticket_ids: newDependsOnIds } : {}),
      });
      setNewTitle("");
      setNewDesc("");
      setNewCriteriaRaw("");
      setNewDependsOnIds([]);
      setShowCreateModal(false);
      await load();
      await openTicket(created);
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreateBusy(false);
    }
  }

  async function moveTicket(ticket: api.StudioTicket, status: api.StudioTicketStatus) {
    if (!projectId) return;
    try {
      await api.patchStudioTicket(projectId, ticket.id, { status });
      await load();
      if (selected?.id === ticket.id) {
        await openTicket({ ...ticket, status });
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function recoverStuckTicketExecution() {
    if (!projectId || !selected) return;
    setRecoverTicketBusy(true);
    setTicketDetailError(null);
    try {
      const t = await api.patchStudioTicket(projectId, selected.id, { recover_stuck_execution: true });
      await load();
      await openTicket(t);
    } catch (e) {
      setTicketDetailError(String(e));
    } finally {
      setRecoverTicketBusy(false);
    }
  }

  async function runLinkedTaskCtl(action: "pause" | "resume" | "cancel") {
    const taskId = selected?.related_task_id?.trim();
    if (!taskId) return;
    setTaskCtlBusy(action);
    try {
      if (action === "pause") await api.pauseTask(taskId);
      else if (action === "resume") await api.resumeTask(taskId);
      else await api.cancelTask(taskId);
      const t = await api.tryGetTask(taskId);
      setLinkedTaskSnapshot(t);
      if (t === null) {
        setLinkedTaskError(
          "Tâche introuvable après l’action (souvent après annulation définitive ou redémarrage du daemon).",
        );
      } else {
        setLinkedTaskError(null);
      }
    } catch (e) {
      setLinkedTaskError(String(e));
    } finally {
      setTaskCtlBusy(null);
    }
  }

  async function reviewTicket(outcome: "approved" | "changes_requested") {
    if (!projectId || !selected) return;
    const corrective_steps = correctiveStepsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const t = await api.reviewStudioTicket(projectId, selected.id, {
        reviewer_agent: selected.review_agent,
        outcome,
        review_notes: reviewNotes.trim() || undefined,
        corrective_steps: outcome === "changes_requested" ? corrective_steps : undefined,
      });
      setSelected(t);
      setReviewNotes("");
      setCorrectiveStepsRaw("");
      await load();
      await openTicket(t);
    } catch (e) {
      setTicketDetailError(String(e));
    }
  }

  function composeTicketMessage(ticket: api.StudioTicket): string {
    return [
      `Implémente le ticket Kanban #${ticket.id}.`,
      `Titre: ${ticket.title}`,
      ticket.description ? `Description: ${ticket.description}` : "",
      "Contraintes:",
      "- Respecter la stack/projet existants.",
      "- Produire des changements concrets et testables.",
      "- Laisser le ticket prêt pour review (status review) en fin d'implémentation.",
      ticket.corrective_steps?.length
        ? `Correctifs demandés précédemment:\n${ticket.corrective_steps.map((s) => `- ${s}`).join("\n")}`
        : "",
      ticket.acceptance_criteria?.length
        ? `Critères d'acceptation:\n${ticket.acceptance_criteria.map((c) => `- ${c.text}`).join("\n")}`
        : "",
      mergedTicketDependencyIds(ticket).length
        ? `Ce ticket ne doit être implémenté qu'après complétion des tickets prérequis suivants (statut done pour chacun) : ${mergedTicketDependencyIds(ticket).join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function playBlockedReason(ticket: api.StudioTicket): string | null {
    if (ticket.status === "in_progress") return "Ticket en cours — Play désactivé";
    if (!ticketPrerequisiteSatisfied(ticket, tickets)) {
      return "Le ticket prérequis doit être terminé (done) avant de lancer celui-ci.";
    }
    return null;
  }

  async function saveDependsOnTicket() {
    if (!projectId || !selected) return;
    setDepPatchBusy(true);
    setDepPatchError(null);
    try {
      const updated = await api.patchStudioTicket(projectId, selected.id, {
        depends_on_ticket_ids: dependsOnDraftIds,
      });
      await load();
      await openTicket(updated);
    } catch (e) {
      setDepPatchError(String(e));
    } finally {
      setDepPatchBusy(false);
    }
  }

  async function launchTicket(ticket: api.StudioTicket) {
    if (!projectId) return;
    if (playBlockedReason(ticket)) return;
    setPlayBusyId(ticket.id);
    setError(null);
    try {
      const payload = await api.sendMessage({
        message: composeTicketMessage(ticket),
        studio_project_id: projectId,
        studio_assigned_agent: ticket.assigned_agent,
        studio_ticket_id: ticket.id,
        studio_ticket_enforcement_mode: ticketEnforcementMode ?? "soft",
      });
      await load();
      await openTicket({ ...ticket, related_task_id: payload.task_id, status: "in_progress" });
      onLaunchTicket({ ...ticket, related_task_id: payload.task_id });
    } catch (e) {
      setError(String(e));
    } finally {
      setPlayBusyId(null);
    }
  }

  async function launchAllTickets() {
    if (!projectId || playAllBusy) return;
    const todoAll = tickets.filter((ticket) => ticket.status === "todo");
    const candidates = todoAll.filter((ticket) => ticketPrerequisiteSatisfied(ticket, tickets));
    const skippedDep = todoAll.length - candidates.length;
    if (!candidates.length) {
      setPlayAllStatus(
        skippedDep > 0
          ? `Aucun ticket « todo » prêt : ${skippedDep} en attente de prérequis (done).`
          : "Aucun ticket « todo » à lancer.",
      );
      return;
    }
    setPlayAllBusy(true);
    setPlayAllStatus(
      `0 / ${candidates.length} tickets lancés${skippedDep > 0 ? ` (${skippedDep} ignorés — prérequis)` : ""}`,
    );
    let processed = 0;
    const errors: string[] = [];
    for (const ticket of candidates) {
      try {
        // Sequential launch keeps timeline readable and avoids daemon overload.
        // eslint-disable-next-line no-await-in-loop
        await api.sendMessage({
          message: composeTicketMessage(ticket),
          studio_project_id: projectId,
          studio_assigned_agent: ticket.assigned_agent,
          studio_ticket_id: ticket.id,
          studio_ticket_enforcement_mode: ticketEnforcementMode ?? "soft",
        });
      } catch (e) {
        errors.push(`${ticket.title}: ${String(e)}`);
      } finally {
        processed += 1;
        setPlayAllStatus(`${processed} / ${candidates.length} tickets lancés`);
      }
    }
    await load();
    if (errors.length) {
      setPlayAllStatus(`${processed} / ${candidates.length} tickets lancés — erreurs: ${errors.join(" | ")}`);
    } else if (skippedDep > 0 && !errors.length) {
      setPlayAllStatus(`${processed} / ${candidates.length} lancés ; ${skippedDep} ticket(s) « todo » ignoré(s) (prérequis non done).`);
    }
    setPlayAllBusy(false);
  }

  function getTheme(status: api.StudioTicketStatus): string {
    return COLUMNS.find((col) => col.id === status)?.theme ?? "slate";
  }

  if (!projectId) {
    return <div className="muted">Sélectionnez un projet pour afficher le Kanban.</div>;
  }

  return (
    <div className="kanban-board">
      <div className="kanban-toolbar panel card">
        <div>
          <h3 style={{ margin: 0 }}>Board tickets</h3>
          <p className="muted" style={{ margin: "6px 0 0 0" }}>
            Lancez ticket par ticket ou en séquence globale depuis le board.
          </p>
        </div>
        <div className="kanban-toolbar-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setNewDependsOnIds([]);
              setCreateError(null);
              setShowCreateModal(true);
            }}
          >
            Nouveau ticket
          </Button>
          <Button onClick={() => void launchAllTickets()} disabled={playAllBusy}>
            {playAllBusy ? "Play all…" : "Play all"}
          </Button>
        </div>
      </div>
      {playAllStatus ? <div className="muted">{playAllStatus}</div> : null}

      {loading && <div className="muted">Chargement tickets…</div>}
      {error && <div className="error">{error}</div>}

      <div className="kanban-columns-grid">
        {COLUMNS.map((col) => (
          <div key={col.id} className={`panel card kanban-column kanban-column--${col.theme}`}>
            <div className={`kanban-column-head kanban-theme-${col.theme}`}>
              <h3 style={{ margin: 0 }}>{col.label}</h3>
              <span className="kanban-column-count">{(byStatus.get(col.id) ?? []).length}</span>
            </div>
            <div className="kanban-column-body">
              {(byStatus.get(col.id) ?? []).map((t) => {
                const depIds = mergedTicketDependencyIds(t);
                const prereqOk = ticketPrerequisiteSatisfied(t, tickets);
                return (
                <article key={t.id} className={`kanban-ticket-card kanban-ticket-card--${getTheme(t.status)}`}>
                  <div className="kanban-ticket-top">
                    <div className="kanban-ticket-title">{t.title}</div>
                    <span className={`kanban-status-badge kanban-theme-${getTheme(t.status)}`}>{t.status}</span>
                  </div>
                  {depIds.length > 0 ? (
                    <div
                      className={`kanban-card-prereq ${prereqOk ? "kanban-card-prereq--ok" : "kanban-card-prereq--wait"}`}
                      style={{ fontSize: 11 }}
                    >
                      {prereqOk ? "Prérequis OK — " : "Après : "}
                      {depIds.map((did, i) => {
                        const dep = tickets.find((x) => x.id === did);
                        return (
                          <span key={did}>
                            {i > 0 ? ", " : ""}
                            <span title={did}>{dep?.title ?? `${did.slice(0, 8)}…`}</span>
                            {!prereqOk && dep ? <span className="muted"> ({dep.status})</span> : null}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t.assigned_agent} {"->"} {t.review_agent}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    task: {t.related_task_id ?? "—"}
                  </div>
                  <div className="kanban-card-actions">
                    <Button size="sm" variant="ghost" onClick={() => void openTicket(t)}>Détail</Button>
                    <Button
                      size="sm"
                      onClick={() => void launchTicket(t)}
                      disabled={playBusyId === t.id || playBlockedReason(t) != null}
                      title={playBlockedReason(t) ?? undefined}
                    >
                      {playBusyId === t.id ? "Play…" : "Play"}
                    </Button>
                  </div>
                </article>
                );
              })}
              {(byStatus.get(col.id) ?? []).length === 0 ? <div className="muted">Aucun ticket.</div> : null}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal-card modal-card--wide kanban-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Détail ticket Kanban"
            onClick={(e) => e.stopPropagation()}
          >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Ticket: {selected.title}</h3>
            <Button variant="ghost" onClick={() => setSelected(null)}>Fermer</Button>
          </div>
          <div className={`kanban-detail-pill kanban-theme-${getTheme(selected.status)}`}>
            Statut: {selected.status} - Assigné: {selected.assigned_agent} - Reviewer: {selected.review_agent}
          </div>
          <p className="muted">{selected.description || "Aucune description."}</p>
          <div className="panel card" style={{ marginTop: 10 }}>
            <h4 style={{ margin: "0 0 8px 0" }}>Prérequis avant Play</h4>
            {mergedTicketDependencyIds(selected).length > 0 ? (
              <div className="muted" style={{ margin: "0 0 8px 0" }}>
                <p style={{ margin: "0 0 6px 0" }}>Ce ticket attend la fin de :</p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {mergedTicketDependencyIds(selected).map((did) => {
                    const d = tickets.find((x) => x.id === did);
                    return (
                      <li key={did}>
                        <strong>{d?.title ?? did}</strong>
                        {d ? (
                          <span>
                            {" "}
                            (<code>{d.status}</code>
                            {d.status === "done" ? " ✓" : ""})
                          </span>
                        ) : (
                          <span className="error"> — introuvable</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="muted" style={{ margin: "6px 0 0 0" }}>
                  {ticketPrerequisiteSatisfied(selected, tickets)
                    ? "Tous les prérequis sont done — Play autorisé."
                    : "Play bloqué jusqu’à ce que chaque prérequis soit en done."}
                </p>
              </div>
            ) : (
              <p className="muted" style={{ margin: "0 0 8px 0" }}>Aucun — vous pouvez lancer dès que le statut le permet.</p>
            )}
            <label className="field">
              <span>Tickets à terminer avant (Ctrl+clic pour plusieurs)</span>
              <select
                className="select"
                multiple
                size={Math.min(8, Math.max(3, tickets.filter((x) => x.id !== selected.id).length))}
                value={dependsOnDraftIds}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setDependsOnDraftIds(opts);
                }}
                style={{ width: "100%", minHeight: 100 }}
              >
                {tickets
                  .filter((x) => x.id !== selected.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title.slice(0, 72)}
                      {x.title.length > 72 ? "…" : ""} ({x.status})
                    </option>
                  ))}
              </select>
            </label>
            {depPatchError ? <div className="error">{depPatchError}</div> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <Button variant="secondary" size="sm" disabled={depPatchBusy} onClick={() => void saveDependsOnTicket()}>
                {depPatchBusy ? "Enregistrement…" : "Enregistrer le prérequis"}
              </Button>
              {mergedTicketDependencyIds(selected).map((did) => (
                <Button
                  key={did}
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={!tickets.some((x) => x.id === did)}
                  onClick={() => {
                    const d = tickets.find((x) => x.id === did);
                    if (d) void openTicket(d);
                  }}
                >
                  Ouvrir « {tickets.find((x) => x.id === did)?.title?.slice(0, 24) ?? did.slice(0, 8)} »
                </Button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              onClick={() => void launchTicket(selected)}
              disabled={playBusyId === selected.id || playBlockedReason(selected) != null}
              title={playBlockedReason(selected) ?? undefined}
            >
              {playBusyId === selected.id ? "Play…" : "Play"}
            </Button>
            <Button variant="ghost" onClick={() => onLaunchTicket(selected)}>Pré-remplir le chat</Button>
            <Button variant="secondary" onClick={() => void moveTicket(selected, "in_progress")}>Passer en cours</Button>
            <Button variant="secondary" onClick={() => void moveTicket(selected, "review")}>Envoyer en review</Button>
          </div>
          {selected.review_outcome ? (
            <div className="panel card" style={{ marginTop: 10 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Dernière review</h4>
              <div className="muted">Verdict: {selected.review_outcome}</div>
              {selected.review_notes ? <p className="muted">{selected.review_notes}</p> : null}
              {selected.corrective_steps?.length ? (
                <ul style={{ marginTop: 6 }}>
                  {selected.corrective_steps.map((step) => <li key={step}>{step}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
          {stuckExecutionHint ? (
            <div
              className="panel card"
              style={{
                marginTop: 10,
                borderLeft: `4px solid ${stuckExecutionHint.tone === "warn" ? "#b45309" : "#2563eb"}`,
              }}
            >
              <p style={{ margin: "0 0 8px 0" }}>{stuckExecutionHint.text}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={recoverTicketBusy || !projectId}
                onClick={() => void recoverStuckTicketExecution()}
              >
                {recoverTicketBusy ? "Déblocage…" : "Débloquer le ticket (revenir en todo)"}
              </Button>
            </div>
          ) : null}
          <div className="panel card kanban-task-track" style={{ marginTop: 10 }}>
            <h4 style={{ margin: "0 0 8px 0" }}>Suivi de la tâche</h4>
            {!selected.related_task_id?.trim() ? (
              <p className="muted" style={{ margin: 0 }}>
                Aucune tâche liée — utilisez <strong>Play</strong> pour démarrer une exécution.
              </p>
            ) : (
              <>
                <div className="muted" style={{ marginBottom: 8 }}>
                  <code>{selected.related_task_id}</code>
                </div>
                {linkedTaskLoading && !linkedTaskSnapshot ? (
                  <p className="hint" style={{ margin: 0 }}>Chargement du statut…</p>
                ) : null}
                {linkedTaskError ? <div className="error">{linkedTaskError}</div> : null}
                {linkedTaskSnapshot ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <p style={{ margin: 0 }}>
                      <strong>{formatTaskStatusFr(linkedTaskSnapshot.status)}</strong>
                      {linkedTaskSnapshot.assigned_agent ? (
                        <span className="muted"> — agent : {linkedTaskSnapshot.assigned_agent}</span>
                      ) : null}
                    </p>
                    {linkedTaskSnapshot.failure_detail ? (
                      <pre className="task-detail-failure kanban-task-track-failure">
                        {linkedTaskSnapshot.failure_detail}
                      </pre>
                    ) : null}
                    {linkedTaskSnapshot.progress && linkedTaskSnapshot.progress.length > 0 ? (
                      <ul className="kanban-task-track-progress">
                        {linkedTaskSnapshot.progress.slice(-8).map((p, idx) => (
                          <li key={`${p.message}-${idx}-${p.progress_pct}`}>
                            {p.progress_pct}% — {p.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted hint" style={{ margin: 0 }}>
                        Pas encore de progression détaillée (la tâche démarre ou est encore en file).
                      </p>
                    )}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!canPauseLinked || taskCtlBusy !== null}
                    title={canPauseLinked ? "Met la tâche en pause (la boucle agent s’arrête au prochain tour)" : undefined}
                    onClick={() => void runLinkedTaskCtl("pause")}
                  >
                    {taskCtlBusy === "pause" ? "Pause…" : "Pause"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!canResumeLinked || taskCtlBusy !== null}
                    onClick={() => void runLinkedTaskCtl("resume")}
                  >
                    {taskCtlBusy === "resume" ? "Reprise…" : "Reprendre"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!canCancelLinked || taskCtlBusy !== null}
                    onClick={() => void runLinkedTaskCtl("cancel")}
                  >
                    {taskCtlBusy === "cancel" ? "Annulation…" : "Annuler la tâche"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!onOpenTaskTracking}
                    title={
                      !onOpenTaskTracking
                        ? "Callback non configuré"
                        : "Ouvre la même vue que depuis le chat : événements, progression, workflow"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selected.related_task_id && onOpenTaskTracking) {
                        onOpenTaskTracking(selected.related_task_id);
                      }
                    }}
                  >
                    Ouvrir le détail de la tâche
                  </Button>
                </div>
              </>
            )}
          </div>
          {selected.status === "review" && (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <Textarea
                placeholder="Notes de review"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
              <Textarea
                placeholder="Étapes correctives (1 par ligne)"
                value={correctiveStepsRaw}
                onChange={(e) => setCorrectiveStepsRaw(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={() => void reviewTicket("approved")}>Valider review</Button>
                <Button variant="secondary" onClick={() => void reviewTicket("changes_requested")}>
                  Demander corrections
                </Button>
              </div>
            </div>
          )}
          <h4>Timeline</h4>
          <div style={{ display: "grid", gap: 6 }}>
            {ticketDetailState === "loading" ? <div className="muted">Chargement du détail ticket…</div> : null}
            {ticketDetailState === "error" ? <div className="error">{ticketDetailError ?? "Erreur de chargement."}</div> : null}
            {ticketDetailState === "ready" && timeline.length === 0 ? <div className="muted">Aucun événement.</div> : null}
            {timeline.map((ev) => (
              <div key={ev.id} className="muted" style={{ fontSize: 12 }}>
                [{new Date(ev.at).toLocaleString()}] {ev.event_type} ({ev.actor})
              </div>
            ))}
          </div>
          </section>
        </div>
      )}

      {showCreateModal ? (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <section
            className="modal-card modal-card--wide"
            role="dialog"
            aria-modal="true"
            aria-label="Nouveau ticket Kanban"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Nouveau ticket</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <Input placeholder="Titre du ticket" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <Textarea placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <Textarea
                placeholder="Critères d'acceptation (1 par ligne)"
                value={newCriteriaRaw}
                onChange={(e) => setNewCriteriaRaw(e.target.value)}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Select value={newAssignedAgent} onChange={(e) => setNewAssignedAgent(e.target.value)}>
                  <option value="studio_scaffold">studio_scaffold</option>
                  <option value="studio_frontend">studio_frontend</option>
                  <option value="studio_backend">studio_backend</option>
                  <option value="studio_fullstack">studio_fullstack</option>
                </Select>
                <Select value={newReviewAgent} onChange={(e) => setNewReviewAgent(e.target.value)}>
                  <option value="studio_reviewer">studio_reviewer</option>
                  <option value="qa">qa</option>
                </Select>
              </div>
              <label className="field">
                <span>Terminer d’abord ces tickets (prérequis, Ctrl+clic)</span>
                <select
                  className="select"
                  multiple
                  size={Math.min(8, Math.max(3, tickets.length))}
                  value={newDependsOnIds}
                  onChange={(e) => {
                    setNewDependsOnIds(Array.from(e.target.selectedOptions).map((o) => o.value));
                  }}
                  style={{ width: "100%", minHeight: 80 }}
                >
                  {tickets.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title.slice(0, 72)}
                      {x.title.length > 72 ? "…" : ""} ({x.status})
                    </option>
                  ))}
                </select>
              </label>
              {createError ? <div className="error">{createError}</div> : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Annuler</Button>
                <Button onClick={() => void createTicket()} disabled={createBusy}>
                  {createBusy ? "Création…" : "Créer ticket"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
