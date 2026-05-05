import { useState } from "react";
import * as api from "./api";
import type { TaskStudioDiffPayload } from "./api";

type Props = {
  diff: TaskStudioDiffPayload;
  projectId: string | null;
  onApplied?: () => void;
};

const STATUS_SLUG_MAP: Record<string, string> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  U: "unmerged",
  "?": "untracked",
  "!": "ignored",
};

function diffStatusSlug(status: string): string {
  const trimmed = status.trim();
  if (trimmed in STATUS_SLUG_MAP) return STATUS_SLUG_MAP[trimmed];
  // Slugify: lowercase, replace anything not alphanumeric/hyphen with hyphen
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

/** Bloc pliable sous une réponse assistant : fichiers modifiés + diff unifié. */
export function ChatStudioDiffPanel({ diff, projectId, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  if (!diff.files.length) return null;

  const splitHunks = (patch: string): { preamble: string[]; hunks: string[] } => {
    const lines = patch.split("\n");
    const preamble: string[] = [];
    const hunks: string[] = [];
    let current: string[] = [];
    let inHunk = false;
    for (const line of lines) {
      if (line.startsWith("@@")) {
        if (current.length > 0) hunks.push(current.join("\n"));
        current = [line];
        inHunk = true;
        continue;
      }
      if (!inHunk) {
        preamble.push(line);
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) hunks.push(current.join("\n"));
    if (hunks.length === 0) {
      return { preamble: [], hunks: [patch] };
    }
    return { preamble, hunks };
  };

  const buildSelectedPatches = (): string[] => {
    const out: string[] = [];
    for (const file of diff.files) {
      const { preamble, hunks } = splitHunks(file.diff);
      const selected = hunks
        .map((h, idx) => ({ h, idx }))
        .filter(({ idx }) => selection[`${file.path}::${idx}`] ?? false)
        .map((x) => x.h);
      if (selected.length === 0) continue;
      out.push(`${preamble.join("\n")}\n${selected.join("\n")}\n`);
    }
    return out;
  };

  const onApply = async (dryRun: boolean) => {
    if (!projectId) return;
    const patches = buildSelectedPatches();
    if (patches.length === 0) {
      setResultMsg("Sélectionnez au moins un hunk.");
      return;
    }
    setBusy(true);
    setResultMsg(null);
    try {
      const r = await api.applyStudioPatchHunks(projectId, { patches, dry_run: dryRun });
      if (r.ok) {
        setResultMsg(`${dryRun ? "Dry-run" : "Patch"} OK (${r.applied}/${r.requested}).`);
        if (!dryRun) onApplied?.();
      } else {
        setResultMsg(`Partiel: ${r.applied}/${r.requested}. ${r.errors.join(" | ")}`);
      }
    } catch (e) {
      setResultMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

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
          <div className="chat-studio-diff-actions">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !projectId} onClick={() => void onApply(true)}>
              Vérifier (dry-run)
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !projectId} onClick={() => void onApply(false)}>
              Appliquer sélection
            </button>
            {resultMsg ? <span className="hint">{resultMsg}</span> : null}
          </div>
          {diff.files.map((f) => (
            <details key={f.path} className="chat-studio-diff-file">
              <summary className="chat-studio-diff-summary">
                <code className="chat-studio-diff-path">{f.path}</code>
                <span className={`chat-studio-diff-status chat-studio-diff-status--${diffStatusSlug(f.status)}`}>{f.status}</span>
                {f.truncated ? <span className="chat-studio-diff-trunc">tronqué</span> : null}
              </summary>
              {(() => {
                const { hunks } = splitHunks(f.diff);
                return (
                  <div>
                    {hunks.map((h, idx) => {
                      const key = `${f.path}::${idx}`;
                      const checked = selection[key] ?? false;
                      return (
                        <div key={key} className="chat-studio-diff-hunk">
                          <label className="field-inline">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelection((prev) => ({
                                  ...prev,
                                  [key]: e.target.checked,
                                }))
                              }
                            />
                            <span>Hunk #{idx + 1}</span>
                          </label>
                          <pre className="chat-studio-diff-pre">{h}</pre>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
