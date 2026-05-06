import { useEffect, useMemo, useState } from "react";
import * as api from "./api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Select } from "./components/ui/select";

const COLUMNS: { id: api.StudioTicketStatus; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];

type KanbanBoardProps = {
  projectId: string | null;
  defaultAgent?: string;
  onLaunchTicket: (ticket: api.StudioTicket) => void;
};

export function KanbanBoard({ projectId, defaultAgent, onLaunchTicket }: KanbanBoardProps) {
  const [tickets, setTickets] = useState<api.StudioTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<api.StudioTicket | null>(null);
  const [timeline, setTimeline] = useState<api.StudioTicketEvent[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [correctiveStepsRaw, setCorrectiveStepsRaw] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssignedAgent, setNewAssignedAgent] = useState(defaultAgent || "studio_fullstack");
  const [newReviewAgent, setNewReviewAgent] = useState("studio_reviewer");

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

  const byStatus = useMemo(() => {
    const map = new Map<api.StudioTicketStatus, api.StudioTicket[]>();
    for (const col of COLUMNS) map.set(col.id, []);
    for (const t of tickets) map.get(t.status)?.push(t);
    return map;
  }, [tickets]);

  async function openTicket(ticket: api.StudioTicket) {
    if (!projectId) return;
    setSelected(ticket);
    try {
      const payload = await api.getStudioTicket(projectId, ticket.id);
      setSelected(payload.ticket);
      setTimeline(payload.timeline);
    } catch {
      setTimeline([]);
    }
  }

  async function createTicket() {
    if (!projectId) return;
    const title = newTitle.trim();
    if (!title) return;
    await api.createStudioTicket(projectId, {
      title,
      description: newDesc.trim(),
      assigned_agent: newAssignedAgent.trim(),
      review_agent: newReviewAgent.trim(),
    });
    setNewTitle("");
    setNewDesc("");
    await load();
  }

  async function moveTicket(ticket: api.StudioTicket, status: api.StudioTicketStatus) {
    if (!projectId) return;
    await api.patchStudioTicket(projectId, ticket.id, { status });
    await load();
    if (selected?.id === ticket.id) {
      await openTicket({ ...ticket, status });
    }
  }

  async function reviewTicket(outcome: "approved" | "changes_requested") {
    if (!projectId || !selected) return;
    const corrective_steps = correctiveStepsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
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
  }

  if (!projectId) {
    return <div className="muted">Sélectionnez un projet pour afficher le Kanban.</div>;
  }

  return (
    <div className="kanban-board">
      <div className="panel card" style={{ marginBottom: 12 }}>
        <h3>Nouveau ticket</h3>
        <div style={{ display: "grid", gap: 8 }}>
          <Input placeholder="Titre du ticket" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Textarea placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Select
              value={newAssignedAgent}
              onChange={(e) => setNewAssignedAgent(e.target.value)}
            >
              <option value="studio_scaffold">studio_scaffold</option>
              <option value="studio_frontend">studio_frontend</option>
              <option value="studio_backend">studio_backend</option>
              <option value="studio_fullstack">studio_fullstack</option>
            </Select>
            <Select
              value={newReviewAgent}
              onChange={(e) => setNewReviewAgent(e.target.value)}
            >
              <option value="studio_reviewer">studio_reviewer</option>
              <option value="qa">qa</option>
            </Select>
          </div>
          <Button onClick={() => void createTicket()}>Créer ticket</Button>
        </div>
      </div>

      {loading && <div className="muted">Chargement tickets…</div>}
      {error && <div className="error">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(220px, 1fr))", gap: 10, alignItems: "start" }}>
        {COLUMNS.map((col) => (
          <div key={col.id} className="panel card">
            <h3 style={{ marginTop: 0 }}>{col.label}</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {(byStatus.get(col.id) ?? []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="btn ghost"
                  style={{ textAlign: "left", width: "100%" }}
                  onClick={() => void openTicket(t)}
                >
                  <div style={{ fontWeight: 700 }}>{t.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t.assigned_agent} {"->"} {t.review_agent}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    task: {t.related_task_id ?? "—"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="panel card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{selected.title}</h3>
            <Button variant="ghost" onClick={() => setSelected(null)}>Fermer</Button>
          </div>
          <p className="muted">{selected.description}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={() => onLaunchTicket(selected)}>Lancer ticket</Button>
            <Button variant="secondary" onClick={() => void moveTicket(selected, "in_progress")}>Passer en cours</Button>
            <Button variant="secondary" onClick={() => void moveTicket(selected, "review")}>Envoyer en review</Button>
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
            {timeline.map((ev) => (
              <div key={ev.id} className="muted" style={{ fontSize: 12 }}>
                [{new Date(ev.at).toLocaleString()}] {ev.event_type} ({ev.actor})
              </div>
            ))}
            {timeline.length === 0 && <div className="muted">Aucun événement.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
