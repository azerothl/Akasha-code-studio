import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./api";

const AGENTS = [
  "",
  "studio_scaffold",
  "studio_frontend",
  "studio_backend",
  "studio_fullstack",
] as const;

export default function App() {
  const [projects, setProjects] = useState<api.StudioProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [editorText, setEditorText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [buildCmd, setBuildCmd] = useState("npm run build");
  const [buildLog, setBuildLog] = useState("");
  const [evolutions, setEvolutions] = useState<api.Evolution[]>([]);
  const [evoLabel, setEvoLabel] = useState("");
  const [selectedEvoId, setSelectedEvoId] = useState<string | null>(null);
  const [chat, setChat] = useState<{ role: "user" | "system"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [agent, setAgent] = useState<string>("studio_scaffold");

  const refreshProjects = useCallback(async () => {
    setError(null);
    try {
      const p = await api.listProjects();
      setProjects(p);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    if (!selectedId) {
      setFiles([]);
      setFilePath(null);
      setEditorText("");
      setPreviewUrl(null);
      setEvolutions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const f = await api.listFiles(selectedId);
        if (!cancelled) setFiles(f);
        const evo = await api.listEvolutions(selectedId).catch(() => []);
        if (!cancelled) setEvolutions(evo);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const refreshEvolutions = useCallback(async () => {
    if (!selectedId) return;
    try {
      const evo = await api.listEvolutions(selectedId);
      setEvolutions(evo);
    } catch {
      setEvolutions([]);
    }
  }, [selectedId]);

  const openFile = async (path: string) => {
    if (!selectedId) return;
    setError(null);
    setFilePath(path);
    try {
      const raw = await api.readRawFile(selectedId, path);
      setEditorText(raw.content ?? "(binaire ou vide)");
      const ext = path.toLowerCase();
      if (ext.endsWith(".html") || ext.endsWith(".htm")) {
        const blob = new Blob([raw.content ?? ""], { type: "text/html" });
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } else {
        setPreviewUrl(null);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onCreateProject = async () => {
    setError(null);
    setStatus("Création…");
    try {
      const p = await api.createProject("Code Studio");
      await refreshProjects();
      setSelectedId(p.id);
      setStatus(`Projet ${p.id}`);
    } catch (e) {
      setError(String(e));
      setStatus("");
    }
  };

  const onClone = async () => {
    if (!selectedId || !cloneUrl.trim()) return;
    setError(null);
    setStatus("git clone…");
    try {
      await api.gitClone(selectedId, cloneUrl.trim());
      const f = await api.listFiles(selectedId);
      setFiles(f);
      setStatus("Clone terminé");
    } catch (e) {
      setError(String(e));
      setStatus("");
    }
  };

  const onBuild = async () => {
    if (!selectedId) return;
    const parts = buildCmd.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return;
    setError(null);
    setBuildLog("…");
    setStatus("Build…");
    try {
      const out = await api.runBuild(selectedId, parts, 300);
      const text = [
        out.error ? `error: ${out.error}` : `exit: ${out.exit_code}`,
        out.stdout ? `--- stdout ---\n${out.stdout}` : "",
        out.stderr ? `--- stderr ---\n${out.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      setBuildLog(text);
      setStatus("Build terminé");
    } catch (e) {
      setBuildLog(String(e));
      setError(String(e));
      setStatus("");
    }
  };

  const onNewEvolution = async () => {
    if (!selectedId) return;
    setError(null);
    try {
      const r = await api.createEvolution(selectedId, evoLabel || undefined);
      setSelectedEvoId(r.evolution_id);
      const evo = await api.listEvolutions(selectedId);
      setEvolutions(evo);
      setStatus(`Branche ${r.branch}`);
    } catch (e) {
      setError(String(e));
    }
  };

  const activeBranch = useMemo(() => {
    if (!selectedEvoId) return null;
    return evolutions.find((e) => e.id === selectedEvoId)?.branch ?? null;
  }, [evolutions, selectedEvoId]);

  const onSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !selectedId) return;
    setChat((c) => [...c, { role: "user", text }]);
    setChatInput("");
    setError(null);
    try {
      const { task_id } = await api.sendMessage({
        message: text,
        studio_project_id: selectedId,
        studio_assigned_agent: agent || undefined,
        studio_evolution_id: selectedEvoId ?? undefined,
        studio_evolution_branch: activeBranch ?? undefined,
      });
      setChat((c) => [...c, { role: "system", text: `Tâche ${task_id} — poll /api/tasks/${task_id}` }]);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="app">
      <h1>
        Akasha Code Studio — sandbox{" "}
        <span style={{ fontWeight: 400, opacity: 0.75 }}>
          (daemon <code>/api/studio</code> + message)
        </span>
      </h1>

      <aside className="sidebar">
        <h2>Projets</h2>
        <button type="button" onClick={onCreateProject}>
          + Nouveau projet
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === selectedId ? "active" : ""}
            onClick={() => setSelectedId(p.id)}
          >
            {p.id.slice(0, 8)}…
          </button>
        ))}

        <h2>Fichiers</h2>
        {files.map((f) => (
          <button
            key={f}
            type="button"
            className={f === filePath ? "active" : ""}
            onClick={() => void openFile(f)}
          >
            {f}
          </button>
        ))}

        <h2>Évolutions</h2>
        <input
          placeholder="label (optionnel)"
          value={evoLabel}
          onChange={(e) => setEvoLabel(e.target.value)}
          style={{ margin: "0 0.5rem", width: "calc(100% - 1rem)", padding: "0.25rem" }}
        />
        <button type="button" onClick={() => void onNewEvolution()}>
          Nouvelle branche studio/*
        </button>
        {evolutions.map((e) => (
          <button
            key={e.id}
            type="button"
            className={e.id === selectedEvoId ? "active" : ""}
            onClick={() => setSelectedEvoId(e.id)}
          >
            {e.branch} ({e.status})
          </button>
        ))}
      </aside>

      <div className="center">
        <div className="editor-pane">
          <div className="pane-title">Éditeur {filePath ? `— ${filePath}` : ""}</div>
          <textarea
            className="editor"
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            placeholder="Sélectionnez un fichier dans l’arbre…"
            spellCheck={false}
          />
        </div>
        <div className="preview-pane">
          <div className="pane-title">Preview (HTML blob)</div>
          {previewUrl ? (
            <iframe className="preview-frame" title="preview" src={previewUrl} sandbox="allow-scripts" />
          ) : (
            <div className="status-line" style={{ padding: "1rem" }}>
              Ouvrez un fichier .html pour la preview locale.
            </div>
          )}
        </div>
      </div>

      <div className="ops-bar">
        <label>
          git clone HTTPS
          <input value={cloneUrl} onChange={(e) => setCloneUrl(e.target.value)} size={28} placeholder="https://…" />
        </label>
        <button type="button" className="secondary" disabled={!selectedId} onClick={() => void onClone()}>
          Cloner
        </button>
        <label>
          Build argv
          <input value={buildCmd} onChange={(e) => setBuildCmd(e.target.value)} size={22} />
        </label>
        <button type="button" disabled={!selectedId} onClick={() => void onBuild()}>
          Lancer build
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!selectedId || !selectedEvoId}
          onClick={() => {
            if (selectedId && selectedEvoId) {
              void api
                .mergeEvolution(selectedId, selectedEvoId)
                .then(() => refreshEvolutions())
                .catch((e) => setError(String(e)));
            }
          }}
        >
          Merge evo → main
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!selectedId || !selectedEvoId}
          onClick={() => {
            if (selectedId && selectedEvoId) {
              void api
                .abandonEvolution(selectedId, selectedEvoId)
                .then(() => refreshEvolutions())
                .catch((e) => setError(String(e)));
            }
          }}
        >
          Abandonner
        </button>
        {error ? <span className="error">{error}</span> : null}
        {status ? <span className="success">{status}</span> : null}
      </div>

      <aside className="chat-panel">
        <div className="pane-title">Chat agent</div>
        <div className="status-line">
          Agent forcé:{" "}
          <select value={agent} onChange={(e) => setAgent(e.target.value)}>
            {AGENTS.map((a) => (
              <option key={a || "default"} value={a}>
                {a || "(sélecteur par défaut)"}
              </option>
            ))}
          </select>
        </div>
        {activeBranch ? (
          <div className="status-line">Branche évolution: {activeBranch}</div>
        ) : null}
        <div className="chat-log">
          {chat.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="chat-form">
          <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Message…" />
          <button type="button" onClick={() => void onSendChat()}>
            Envoyer
          </button>
        </div>
        <div className="pane-title">Logs build</div>
        <pre
          style={{
            margin: 0,
            padding: "0.4rem",
            fontSize: "0.7rem",
            overflow: "auto",
            maxHeight: "120px",
            background: "#0e1015",
          }}
        >
          {buildLog || "—"}
        </pre>
      </aside>
    </div>
  );
}
