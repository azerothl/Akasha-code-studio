import { useId } from "react";
import { AlertCircle, CheckCircle2, FolderOpen, Info, LoaderCircle, WifiOff } from "lucide-react";
import { Button } from "./components/ui/button";
import { redactSecrets } from "./sendContext";
import "./asyncState.css";

type StateKind = "loading" | "empty" | "partial" | "offline" | "error" | "success";
type Action = { label: string; onClick: () => void; disabled?: boolean };

/** Inline feedback stays beside the affected content and keeps recovery keyboard accessible. */
export function AsyncState({ kind, title, description, detail, action, secondaryAction, progress }: {
  kind: StateKind;
  title: string;
  description?: string;
  detail?: string | null;
  action?: Action;
  secondaryAction?: Action;
  progress?: number;
}) {
  const id = useId();
  const Icon = { loading: LoaderCircle, empty: FolderOpen, partial: Info, offline: WifiOff, error: AlertCircle, success: CheckCircle2 }[kind];
  return (
    <section className={`async-state async-state--${kind}`} aria-labelledby={id} aria-busy={kind === "loading"}>
      <Icon className="async-state-icon" size={20} aria-hidden="true" />
      <div className="async-state-content">
        <div role={kind === "error" ? "alert" : "status"} aria-atomic="true">
          <h3 id={id}>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {kind === "loading" ? <progress aria-label={title} max={100} value={progress} /> : null}
        {detail ? <details><summary>Détails techniques</summary><pre>{redactSecrets(detail)}</pre></details> : null}
        {action || secondaryAction ? (
          <div className="async-state-actions">
            {action ? <Button type="button" size="sm" variant="secondary" onClick={action.onClick} disabled={action.disabled}>{action.label}</Button> : null}
            {secondaryAction ? <Button type="button" size="sm" variant="ghost" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>{secondaryAction.label}</Button> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
