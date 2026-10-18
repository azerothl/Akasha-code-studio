import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, Code2, Columns2, Files, GitBranch, MessageSquare, PanelLeft, PanelRight, SlidersHorizontal, X } from "lucide-react";
import { Button } from "./components/ui/button";
import { NotificationCenter } from "./components/NotificationCenter";

type Split = "chat" | "center" | "balanced";

export function WorkspaceHeader({ projectName, branch, online, connectionLabel, split, onSplit, onProject, onTools }: {
  projectName?: string; branch: string | null; online: boolean; connectionLabel: string;
  split: Split; onSplit: (value: Split) => void; onProject: () => void; onTools: () => void;
}) {
  return <header className="workspace-header">
    <div className="workspace-heading">
      <h1 className="sr-only">Code Studio</h1>
      <Button variant="ghost" className="workspace-project" onClick={onProject} aria-label="Choisir un projet">
        <span>{projectName || "Code Studio"}</span><ChevronDown size={14} aria-hidden="true" />
      </Button>
      {branch ? <span className="workspace-branch"><GitBranch size={13} aria-hidden="true" />{branch}</span> : null}
    </div>
    <div className="workspace-header-actions">
      <span className={`connection-dot ${online ? "is-online" : ""}`} role="img" aria-label={`Daemon : ${connectionLabel}`} title={`Daemon : ${connectionLabel}`} />
      <div className="workspace-layout" role="group" aria-label="Disposition de l’espace de travail">
        {([{ value: "center", label: "Plein éditeur", icon: PanelLeft }, { value: "balanced", label: "Vue adaptative", icon: Columns2 }, { value: "chat", label: "Plein chat", icon: PanelRight }] as const).map(({ value, label, icon: Icon }) =>
          <Button key={value} variant="ghost" size="icon" aria-label={label} title={label} aria-pressed={split === value} onClick={() => onSplit(value)}><Icon size={16} aria-hidden="true" /></Button>)}
      </div>
      <NotificationCenter />
      <Button variant="ghost" size="icon" onClick={onTools} aria-label="Outils du projet" title="Outils du projet"><SlidersHorizontal size={18} aria-hidden="true" /></Button>
    </div>
  </header>;
}

/** Native dialog supplies focus containment, Escape and restoration to its trigger. */
export function WorkspaceTools({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className="workspace-tools" aria-labelledby="workspace-tools-title" onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="workspace-tools-inner">
      <div className="workspace-tools-heading"><h2 id="workspace-tools-title">Outils du projet</h2><Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer les outils"><X size={18} aria-hidden="true" /></Button></div>
      {children}
    </div>
  </dialog>;
}

export function MobileWorkspaceNav({ active, onSelect }: { active: "chat" | "editor" | "preview" | null; onSelect: (value: "chat" | "editor" | "preview") => void }) {
  return <nav className="mobile-workspace-nav" aria-label="Navigation mobile">
    {([{ id: "chat", label: "Discussion", icon: MessageSquare }, { id: "editor", label: "Fichiers", icon: Files }, { id: "preview", label: "Aperçu", icon: Code2 }] as const).map(({ id, label, icon: Icon }) =>
      <Button key={id} variant="ghost" aria-current={active === id ? "page" : undefined} onClick={() => onSelect(id)}><Icon size={19} aria-hidden="true" /><span>{label}</span></Button>)}
  </nav>;
}

export function ChatWelcome({ hasProject, onCreate, onLoad, onPrompt }: { hasProject: boolean; onCreate: () => void; onLoad: () => void; onPrompt: (text: string) => void }) {
  return <div className="chat-welcome">
    <Code2 size={30} strokeWidth={1.5} aria-hidden="true" />
    <h2>{hasProject ? "Que souhaitez-vous construire ?" : "Votre prochain projet commence ici."}</h2>
    <p>{hasProject ? "Décrivez une idée, une modification ou un problème à résoudre." : "Créez un projet ou ouvrez votre travail pour commencer avec l’agent."}</p>
    {hasProject ? <div className="chat-starters">
      {["Explorer ce projet", "Proposer une amélioration"].map((label, index) => <Button key={label} variant="ghost" onClick={() => onPrompt(index === 0 ? "Explore ce projet et résume son architecture." : "Analyse ce projet et propose une amélioration concrète.")}>{label}<ArrowUpRight size={15} aria-hidden="true" /></Button>)}
    </div> : <div className="chat-welcome-actions"><Button onClick={onCreate}>Créer un projet</Button><Button variant="ghost" onClick={onLoad}>Ouvrir un projet</Button></div>}
  </div>;
}
