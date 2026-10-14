import { Button } from "./components/ui/button";
import { buildForkNodes, type ForkNode } from "./forkTree";

type Message = {
  role: string;
  text: string;
  task_id?: string;
  fork_parent_task_id?: string;
  fork_cut_index?: number;
};

type Props = {
  messages: Message[];
  events: { event_type: string; task_id?: string | null; payload?: unknown }[];
  activeTaskId: string | null;
  inspectedTaskId: string | null;
  onInspect: (taskId: string | null) => void;
};

export function ForkTreePanel({ messages, events, activeTaskId, inspectedTaskId, onInspect }: Props) {
  const nodes = buildForkNodes(messages, events, activeTaskId);
  if (nodes.length < 2 && !nodes.some((node) => node.parentTaskId)) return null;
  const inspected = inspectedTaskId ? nodes.find((node) => node.taskId === inspectedTaskId) ?? null : null;
  const transcript = inspectedTaskId
    ? messages.filter((message) => message.task_id === inspectedTaskId)
    : [];
  return (
    <section className="fork-tree" aria-label="Arbre de forks">
      <p className="fork-tree-title">Branches de conversation</p>
      <ul className="fork-tree-list">
        {nodes.map((node) => (
          <li key={node.taskId}>
            <ForkRow node={node} onInspect={onInspect} />
          </li>
        ))}
      </ul>
      {inspected ? (
        <div className="fork-tree-transcript">
          <p className="hint">
            Transcript de la branche consultée, sans remplacer la conversation affichée.
            {inspected.cutIndex !== null ? ` Coupure au message #${inspected.cutIndex + 1}.` : ""}
          </p>
          {transcript.length === 0 ? <p className="hint">Aucun message local pour cette branche.</p> : null}
          {transcript.map((message, index) => (
            <p key={`${message.task_id ?? "fork"}-${index}`} className="fork-tree-line">
              <strong>{message.role === "user" ? "Vous" : "Agent"}.</strong> {message.text.slice(0, 240)}
            </p>
          ))}
          {inspected.parentTaskId ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => onInspect(inspected.parentTaskId)}>
              Revenir au parent
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={() => onInspect(null)}>
            Fermer le transcript
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ForkRow({ node, onInspect }: { node: ForkNode; onInspect: (taskId: string) => void }) {
  return (
    <Button type="button" size="sm" variant={node.active ? "default" : "ghost"} onClick={() => onInspect(node.taskId)}>
      {node.active ? "Branche active · " : ""}
      {node.label}
      {node.parentTaskId ? ` · parent ${node.parentTaskId.slice(0, 8)}` : ""}
    </Button>
  );
}
