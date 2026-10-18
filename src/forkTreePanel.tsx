import { useEffect, useState } from "react";
import * as api from "./api";
import type { ChatMessage } from "./chatStorage";
import { Button } from "./components/ui/button";
import { buildForkNodes, type ForkNode } from "./forkTree";
import { formatTaskStatusFr } from "./studioUiModel";
import { MarkdownBlock } from "./markdownBlock";

type Props = {
  messages: ChatMessage[];
  events: api.TaskEventEntry[];
  activeTaskId: string | null;
  activeTaskStatus?: string;
  inspectedTaskId: string | null;
  onInspect: (taskId: string | null) => void;
};

export function ForkTreePanel({ messages, events, activeTaskId, activeTaskStatus, inspectedTaskId, onInspect }: Props) {
  const nodes = buildForkNodes(messages, events, activeTaskId);
  const ids = nodes.map(node => node.taskId).sort().join(",");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    setStatuses({});
    const pending = ids.split(",").filter(Boolean);
    let cursor = 0;
    void Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
      while (!cancelled && cursor < pending.length) {
        const id = pending[cursor++];
        try {
          const task = await api.getTask(id);
          if (!cancelled) setStatuses(previous => ({ ...previous, [id]: task.status }));
        } catch { /* persisted local status remains available when the daemon cannot answer */ }
      }
    }));
    return () => { cancelled = true; };
  }, [ids, activeTaskStatus]);

  if (nodes.length < 2 && !nodes.some(node => node.parentTaskId)) return null;
  const inspected = nodes.find(node => node.taskId === inspectedTaskId);
  const transcript = messages.filter(message => message.task_id === inspectedTaskId);
  const status = (node: ForkNode) => node.active && activeTaskStatus ? activeTaskStatus : statuses[node.taskId] || node.status;
  const rendered = new Set<string>();
  const renderNode = (node: ForkNode) => {
    if (rendered.has(node.taskId)) return null;
    rendered.add(node.taskId);
    const children = nodes.filter(child => child.parentTaskId === node.taskId && !rendered.has(child.taskId));
    return (
      <li key={node.taskId}>
        <Button type="button" size="sm" variant={node.active ? "default" : "ghost"} aria-pressed={node.taskId === inspectedTaskId} onClick={() => onInspect(node.taskId)}>
          {node.active ? "Branche active · " : ""}{node.label} · {status(node) ? formatTaskStatusFr(status(node)!) : "Statut indisponible"}
          {node.cutIndex !== null ? ` · coupure #${node.cutIndex + 1}` : ""}
        </Button>
        {children.length ? <ul className="fork-tree-children">{children.map(renderNode)}</ul> : null}
      </li>
    );
  };
  const roots = nodes.filter(node => !node.parentTaskId || !nodes.some(parent => parent.taskId === node.parentTaskId));
  const tree = roots.map(renderNode);
  // Corrupt/cyclic event data must not hide an entire branch or recurse forever.
  for (const node of nodes) if (!rendered.has(node.taskId)) tree.push(renderNode(node));
  return (
    <section className="fork-tree" aria-label="Arbre de forks">
      <h3 className="fork-tree-title">Branches de conversation</h3>
      <ul className="fork-tree-list">{tree}</ul>
      {inspected ? (
        <div className="fork-tree-transcript" role="region" aria-label="Transcript de la branche consultée" tabIndex={0}>
          <p className="hint">Historique local conservé pour cette branche. La conversation active reste affichée.</p>
          {transcript.length === 0 ? <p className="hint">Aucun message local pour cette branche.</p> : null}
          {transcript.map((message, index) => (
            <div key={`${message.task_id}-${index}`} className="fork-tree-line">
              <strong>{message.role === "user" ? "Vous" : "Agent"}</strong><MarkdownBlock text={message.text} />
            </div>
          ))}
          {inspected.parentTaskId ? <Button type="button" size="sm" variant="secondary" onClick={() => onInspect(inspected.parentTaskId)}>Revenir au parent</Button> : null}
          <Button type="button" size="sm" variant="ghost" onClick={() => onInspect(null)}>Fermer le transcript</Button>
        </div>
      ) : null}
    </section>
  );
}
