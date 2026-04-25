import { useState } from "react";
import type { TaskStudioDiffPayload } from "./api";

type Props = {
  diff: TaskStudioDiffPayload;
};

/** Bloc pliable sous une réponse assistant : fichiers modifiés + diff unifié. */
export function ChatStudioDiffPanel({ diff }: Props) {
  const [open, setOpen] = useState(false);
  if (!diff.files.length) return null;

  return (
    <div className="chat-studio-diff">
      <button
        type="button"
        className="chat-studio-diff-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Fichiers modifiés ({diff.files.length})
        {open ? " — masquer" : " — afficher"}
      </button>
      {open ? (
        <div className="chat-studio-diff-body">
          {diff.files.map((f) => (
            <details key={f.path} className="chat-studio-diff-file">
              <summary className="chat-studio-diff-summary">
                <code className="chat-studio-diff-path">{f.path}</code>
                <span className={`chat-studio-diff-status chat-studio-diff-status--${f.status}`}>{f.status}</span>
                {f.truncated ? <span className="chat-studio-diff-trunc">tronqué</span> : null}
              </summary>
              <pre className="chat-studio-diff-pre">{f.diff}</pre>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
