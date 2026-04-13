import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as api from "./api";
import { loadChatMessages, saveChatMessages } from "./chatStorage";
import {
  BASE_STACK_PRESETS,
  STACK_ADDON_GROUPS,
  STACK_PRESET_CUSTOM,
  STACK_PRESET_NONE,
  type StackAddonCategoryId,
  composeStackString,
  emptyStackAddons,
} from "./stackConfig";
import { CodeEditor } from "./codeEditor";

const AGENT_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "", label: "Automatique", hint: "Le daemon choisit l’agent (peut ignorer le mode studio)." },
  {
    value: "studio_scaffold",
    label: "Squelette d’app",
    hint: "Vite + React + TS, structure minimale et README.",
  },
  {
    value: "studio_frontend",
    label: "Frontend",
    hint: "Composants UI, styles, accessibilité, routing client.",
  },
  {
    value: "studio_backend",
    label: "Backend",
    hint: "API, persistance légère, CORS, configuration.",
  },
  {
    value: "studio_fullstack",
    label: "Full-stack",
    hint: "Frontend + backend cohérents dans un même passage.",
  },
];

type StackFieldsProps = {
  selectId: string;
  presetId: string;
  onPresetChange: (v: string) => void;
  customText: string;
  onCustomTextChange: (v: string) => void;
  addons: Record<StackAddonCategoryId, string[]>;
  onToggleAddon: (cat: StackAddonCategoryId, optId: string) => void;
  composedStack: string;
};

function StackFields({
  selectId,
  presetId,
  onPresetChange,
  customText,
  onCustomTextChange,
  addons,
  onToggleAddon,
  composedStack,
}: StackFieldsProps) {
  const showCustom = presetId === STACK_PRESET_CUSTOM;
  const showPreview = presetId !== STACK_PRESET_NONE && presetId !== STACK_PRESET_CUSTOM;

  return (
    <>
      <label className="field stack-select-field">
        <span>Modèle de stack</span>
        <select id={selectId} value={presetId} onChange={(e) => onPresetChange(e.target.value)}>
          <option value={STACK_PRESET_NONE}>— Aucune stack —</option>
          {BASE_STACK_PRESETS.filter((p) => p.id !== STACK_PRESET_CUSTOM).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value={STACK_PRESET_CUSTOM}>Personnalisé (texte libre)</option>
        </select>
      </label>
      {presetId !== STACK_PRESET_NONE ? (
        <details className="stack-addons-details">
          <summary>Affiner avec des cases à cocher (optionnel)</summary>
          <div className="stack-addon-groups">
            {STACK_ADDON_GROUPS.map((g) => (
              <fieldset key={g.id} className="stack-addon-group">
                <legend>{g.title}</legend>
                <div className="stack-addon-chips">
                  {g.options.map((o) => {
                    const checked = (addons[g.id] ?? []).includes(o.id);
                    return (
                      <label key={o.id} className="stack-addon-label">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleAddon(g.id, o.id)}
                        />
                        {o.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </details>
      ) : (
        <p className="hint stack-addons-hint">
          Choisissez un modèle ou « Personnalisé » pour activer les précisions par catégorie.
        </p>
      )}
      {showPreview ? (
        <label className="field">
          <span>Aperçu (texte injecté côté daemon)</span>
          <textarea className="stack-textarea" readOnly rows={6} value={composedStack} spellCheck={false} />
        </label>
      ) : null}
      {showCustom ? (
        <label className="field">
          <span>Stack libre</span>
          <textarea
            className="stack-textarea"
            rows={8}
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            placeholder="Décrivez langages, frameworks, conventions, outils…"
            spellCheck={false}
          />
        </label>
      ) : null}
    </>
  );
}

function CollapsiblePanel({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="panel panel-collapsible">
      <button type="button" className="panel-collapse-trigger" onClick={onToggle} aria-expanded={open}>
        <span className="panel-collapse-chevron" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
        <h2>{title}</h2>
      </button>
      {open ? <div className="panel-collapse-inner">{children}</div> : null}
    </section>
  );
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

export default function App() {
  const [projects, setProjects] = useState<api.StudioProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("Mon application");
  const [newStackPresetId, setNewStackPresetId] = useState(STACK_PRESET_NONE);
  const [newStackCustomText, setNewStackCustomText] = useState("");
  const [newStackAddons, setNewStackAddons] = useState(() => emptyStackAddons());
  const [renameDraft, setRenameDraft] = useState("");
  const [stackPresetId, setStackPresetId] = useState(STACK_PRESET_NONE);
  const [stackCustomText, setStackCustomText] = useState("");
  const [stackAddons, setStackAddons] = useState(() => emptyStackAddons());
  const [files, setFiles] = useState<string[]>([]);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [editorText, setEditorText] = useState("");
  /** Aperçu HTML statique (blob) depuis un fichier ouvert. */
  const [staticPreviewBlobUrl, setStaticPreviewBlobUrl] = useState<string | null>(null);
  /** URL du serveur dev lancé par le daemon (`npm run dev`). */
  const [devPreviewUrl, setDevPreviewUrl] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<"editor" | "preview">("editor");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewLog, setPreviewLog] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [buildCmd, setBuildCmd] = useState("npm run build");
  const [buildLog, setBuildLog] = useState("");
  const [evolutions, setEvolutions] = useState<api.Evolution[]>([]);
  const [evoLabel, setEvoLabel] = useState("");
  const [selectedEvoId, setSelectedEvoId] = useState<string | null>(null);
  const [chat, setChat] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [agent, setAgent] = useState<string>("studio_scaffold");
  const [taskTrace, setTaskTrace] = useState<{
    id: string;
    status: string;
    line: string;
    done: boolean;
  } | null>(null);

  const [modalCreateOpen, setModalCreateOpen] = useState(false);
  const [modalLoadOpen, setModalLoadOpen] = useState(false);
  const [sidebarLeftVisible, setSidebarLeftVisible] = useState(true);
  const [sidebarRightVisible, setSidebarRightVisible] = useState(true);
  const [sectionOpen, setSectionOpen] = useState({
    project: true,
    files: true,
    settings: false,
    evolutions: false,
  });

  const skipChatSaveOnce = useRef(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const composedStack = useMemo(
    () => composeStackString(stackPresetId, stackCustomText, stackAddons),
    [stackPresetId, stackCustomText, stackAddons],
  );

  const newProjectComposedStack = useMemo(
    () => composeStackString(newStackPresetId, newStackCustomText, newStackAddons),
    [newStackPresetId, newStackCustomText, newStackAddons],
  );

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
      setChat([]);
      return;
    }
    skipChatSaveOnce.current = true;
    setChat(loadChatMessages(selectedId));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (skipChatSaveOnce.current) {
      skipChatSaveOnce.current = false;
      return;
    }
    saveChatMessages(selectedId, chat);
  }, [selectedId, chat]);

  useEffect(() => {
    setRenameDraft(selectedProject?.name ?? "");
  }, [selectedProject?.id, selectedProject?.name]);

  useEffect(() => {
    if (!selectedId) {
      setStackPresetId(STACK_PRESET_NONE);
      setStackCustomText("");
      setStackAddons(emptyStackAddons());
      return;
    }
    let cancelled = false;
    void api
      .getProjectMeta(selectedId)
      .then((m) => {
        if (cancelled) return;
        const raw = (m.tech_stack ?? "").trim();
        if (raw) {
          setStackPresetId(STACK_PRESET_CUSTOM);
          setStackCustomText(m.tech_stack ?? "");
          setStackAddons(emptyStackAddons());
        } else {
          setStackPresetId(STACK_PRESET_NONE);
          setStackCustomText("");
          setStackAddons(emptyStackAddons());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStackPresetId(STACK_PRESET_NONE);
          setStackCustomText("");
          setStackAddons(emptyStackAddons());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const toggleStackAddon = useCallback((cat: StackAddonCategoryId, optId: string) => {
    setStackAddons((prev) => {
      const cur = prev[cat];
      const next = cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId];
      return { ...prev, [cat]: next };
    });
  }, []);

  const toggleNewStackAddon = useCallback((cat: StackAddonCategoryId, optId: string) => {
    setNewStackAddons((prev) => {
      const cur = prev[cat];
      const next = cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId];
      return { ...prev, [cat]: next };
    });
  }, []);

  const onStackPresetSelect = useCallback(
    (next: string) => {
      if (
        next === STACK_PRESET_CUSTOM &&
        stackPresetId !== STACK_PRESET_CUSTOM &&
        stackPresetId !== STACK_PRESET_NONE
      ) {
        setStackCustomText(composeStackString(stackPresetId, stackCustomText, stackAddons));
      }
      if (next !== STACK_PRESET_CUSTOM && next !== STACK_PRESET_NONE) {
        setStackCustomText("");
      }
      setStackPresetId(next);
    },
    [stackPresetId, stackCustomText, stackAddons],
  );

  const onNewStackPresetSelect = useCallback(
    (next: string) => {
      if (
        next === STACK_PRESET_CUSTOM &&
        newStackPresetId !== STACK_PRESET_CUSTOM &&
        newStackPresetId !== STACK_PRESET_NONE
      ) {
        setNewStackCustomText(
          composeStackString(newStackPresetId, newStackCustomText, newStackAddons),
        );
      }
      if (next !== STACK_PRESET_CUSTOM && next !== STACK_PRESET_NONE) {
        setNewStackCustomText("");
      }
      setNewStackPresetId(next);
    },
    [newStackPresetId, newStackCustomText, newStackAddons],
  );

  useEffect(() => {
    if (!selectedId) {
      setFiles([]);
      setFilePath(null);
      setEditorText("");
      setStaticPreviewBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setDevPreviewUrl(null);
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

  const refreshFiles = useCallback(async () => {
    if (!selectedId) return;
    setError(null);
    try {
      const f = await api.listFiles(selectedId);
      setFiles(f);
      setStatus("Fichiers actualisés");
    } catch (e) {
      setError(String(e));
    }
  }, [selectedId]);

  const onPlayPreview = useCallback(async () => {
    if (!selectedId) return;
    setPreviewBusy(true);
    setPreviewLog("");
    setError(null);
    try {
      const r = await api.startStudioPreview(selectedId, { force_install: false });
      setDevPreviewUrl(r.url);
      if (r.install) {
        const { stdout, stderr } = r.install;
        setPreviewLog([stdout, stderr].filter(Boolean).join("\n"));
      } else {
        setPreviewLog("");
      }
      setCenterTab("preview");
      setStatus(`Prévisualisation : ${r.url}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setPreviewBusy(false);
    }
  }, [selectedId]);

  const onStopPreview = useCallback(async () => {
    if (!selectedId) return;
    setError(null);
    try {
      await api.stopStudioPreview(selectedId);
      setDevPreviewUrl(null);
      setStatus("Prévisualisation arrêtée");
    } catch (e) {
      setError(String(e));
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
        setStaticPreviewBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } else {
        setStaticPreviewBlobUrl(null);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    return () => {
      if (staticPreviewBlobUrl) URL.revokeObjectURL(staticPreviewBlobUrl);
    };
  }, [staticPreviewBlobUrl]);

  useEffect(() => {
    const id = selectedId;
    return () => {
      if (id) {
        void api.stopStudioPreview(id).catch(() => {});
      }
      setDevPreviewUrl(null);
    };
  }, [selectedId]);

  const onCreateProject = async () => {
    setError(null);
    setStatus("Création du projet…");
    try {
      const name = newProjectName.trim() || "Nouveau projet";
      const stack = newProjectComposedStack.trim();
      const p = await api.createProject({
        name,
        ...(stack ? { tech_stack: stack } : {}),
      });
      await refreshProjects();
      setSelectedId(p.id);
      setNewStackPresetId(STACK_PRESET_NONE);
      setNewStackCustomText("");
      setNewStackAddons(emptyStackAddons());
      setModalCreateOpen(false);
      setStatus(`Projet « ${name} » créé`);
    } catch (e) {
      setError(String(e));
      setStatus("");
    }
  };

  const onRenameProject = async () => {
    if (!selectedId) return;
    const n = renameDraft.trim();
    if (!n) {
      setError("Indiquez un nom d’affichage.");
      return;
    }
    setError(null);
    try {
      await api.patchProjectSettings(selectedId, { name: n });
      await refreshProjects();
      setStatus("Nom du projet mis à jour");
    } catch (e) {
      setError(String(e));
    }
  };

  const onSaveTechStack = async () => {
    if (!selectedId) return;
    setError(null);
    const t = composedStack.trim();
    try {
      await api.patchProjectSettings(selectedId, { tech_stack: t.length ? t : null });
      setStatus(t.length ? "Stack technique enregistrée" : "Stack technique effacée");
    } catch (e) {
      setError(String(e));
    }
  };

  const onClone = async () => {
    if (!selectedId || !cloneUrl.trim()) return;
    setError(null);
    setStatus("Clonage du dépôt…");
    try {
      await api.gitClone(selectedId, cloneUrl.trim());
      const f = await api.listFiles(selectedId);
      setFiles(f);
      setStatus("Clone terminé — fichiers actualisés");
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
    setStatus("Build en cours…");
    try {
      const out = await api.runBuild(selectedId, parts, 300);
      const text = [
        out.error ? `Erreur: ${out.error}` : `Code de sortie: ${out.exit_code}`,
        out.stdout ? `--- sortie standard ---\n${out.stdout}` : "",
        out.stderr ? `--- erreurs ---\n${out.stderr}` : "",
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
      setStatus(`Branche créée : ${r.branch}`);
    } catch (e) {
      setError(String(e));
    }
  };

  const activeBranch = useMemo(() => {
    if (!selectedEvoId) return null;
    return evolutions.find((e) => e.id === selectedEvoId)?.branch ?? null;
  }, [evolutions, selectedEvoId]);

  const pollTask = useCallback(
    async (taskId: string) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      try {
        for (let i = 0; i < 120; i++) {
          const t = await api.getTask(taskId);
          const last = t.progress?.length ? t.progress[t.progress.length - 1] : undefined;
          const line = last
            ? `${last.progress_pct}% — ${last.message}`
            : formatTaskStatusFr(t.status);
          setTaskTrace({
            id: taskId,
            status: t.status,
            line,
            done: api.isTaskTerminal(t.status) || api.isTaskNeedsUser(t.status),
          });
          if (api.isTaskTerminal(t.status) || api.isTaskNeedsUser(t.status)) {
            if (api.isTaskTerminal(t.status) && t.status === "completed" && selectedId) {
              try {
                setFiles(await api.listFiles(selectedId));
              } catch {
                /* ignore */
              }
            }
            const summary =
              t.status === "completed"
                ? "La tâche est terminée. Les nouveaux fichiers apparaissent dans l’arborescence (rafraîchissement automatique)."
                : t.status === "failed"
                  ? "La tâche a échoué — voir l’onglet Tâches dans l’UI Akasha principale ou les logs du daemon."
                  : t.status === "waiting_user_input"
                    ? "Le daemon attend une validation (approbation d’outil ou question utilisateur)."
                    : `État : ${formatTaskStatusFr(t.status)}`;
            setChat((c) => [...c, { role: "assistant", text: summary }]);
            return;
          }
          await sleep(1500);
        }
        setTaskTrace((prev) =>
          prev
            ? {
                ...prev,
                line: "Suivi arrêté (timeout côté UI après ~3 min). La tâche peut encore tourner — vérifiez l’UI Akasha ou GET /api/tasks/…",
                done: true,
              }
            : null,
        );
        setChat((c) => [
          ...c,
          {
            role: "assistant",
            text: "Le suivi automatique a expiré. Ouvrez l’interface Akasha habituelle ou interrogez GET /api/tasks/{id} pour l’état réel.",
          },
        ]);
      } catch (e) {
        setTaskTrace((prev) =>
          prev ? { ...prev, line: `Erreur de suivi : ${e}`, done: true } : null,
        );
      }
    },
    [selectedId],
  );

  const onSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !selectedId) return;
    setChat((c) => [...c, { role: "user", text }]);
    setChatInput("");
    setError(null);
    setTaskTrace(null);
    try {
      const { task_id } = await api.sendMessage({
        message: text,
        studio_project_id: selectedId,
        studio_assigned_agent: agent || undefined,
        studio_evolution_id: selectedEvoId ?? undefined,
        studio_evolution_branch: activeBranch ?? undefined,
      });
      setTaskTrace({
        id: task_id,
        status: "queued",
        line: "Requête acceptée par le daemon — démarrage…",
        done: false,
      });
      void pollTask(task_id);
    } catch (e) {
      setError(String(e));
    }
  };

  const agentHint = AGENT_OPTIONS.find((o) => o.value === agent)?.hint ?? "";

  const appClass =
    "app" +
    (!sidebarLeftVisible ? " app--hide-left" : "") +
    (!sidebarRightVisible ? " app--hide-right" : "");

  return (
    <div className={appClass}>
      <header className="app-header app-header--compact">
        <div className="app-header-row">
          <h1>Code Studio</h1>
          <div className="app-header-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={sidebarLeftVisible}
              title="Afficher ou masquer le panneau gauche"
              onClick={() => setSidebarLeftVisible((v) => !v)}
            >
              {sidebarLeftVisible ? "◀ Gauche" : "▶ Gauche"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={sidebarRightVisible}
              title="Afficher ou masquer le panneau chat"
              onClick={() => setSidebarRightVisible((v) => !v)}
            >
              {sidebarRightVisible ? "Chat ▶" : "◀ Chat"}
            </button>
          </div>
        </div>
      </header>

      <aside className="sidebar" aria-hidden={!sidebarLeftVisible}>
        <CollapsiblePanel
          title="Projet"
          open={sectionOpen.project}
          onToggle={() => setSectionOpen((s) => ({ ...s, project: !s.project }))}
        >
          <div className="project-actions-row">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalCreateOpen(true)}>
              Créer un projet
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              data-testid="studio-load-project"
              onClick={() => setModalLoadOpen(true)}
            >
              Charger un projet
            </button>
          </div>
          {selectedProject ? (
            <p className="current-project-line">
              <span className="current-project-name">{selectedProject.name}</span>
              <span className="project-id">{selectedProject.id.slice(0, 8)}…</span>
            </p>
          ) : (
            <p className="hint">Aucun projet chargé — utilisez les boutons ci-dessus.</p>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Fichiers du projet"
          open={sectionOpen.files}
          onToggle={() => setSectionOpen((s) => ({ ...s, files: !s.files }))}
        >
          <div className="panel-files-header panel-files-header--inline">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!selectedId}
              title="Recharger la liste depuis le daemon"
              onClick={() => void refreshFiles()}
            >
              Rafraîchir
            </button>
          </div>
          {!selectedId ? (
            <p className="hint">Sélectionnez un projet pour voir ses fichiers.</p>
          ) : files.length === 0 ? (
            <p className="hint">
              Aucun fichier encore — envoyez une consigne à l’agent ou clonez un dépôt. Après une tâche terminée, utilisez
              « Rafraîchir » si la liste ne se met pas à jour.
            </p>
          ) : (
            <ul className="file-list">
              {files.map((f) => (
                <li key={f}>
                  <button
                    type="button"
                    className={f === filePath ? "active" : ""}
                    onClick={() => void openFile(f)}
                  >
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CollapsiblePanel>

        {selectedId ? (
          <CollapsiblePanel
            title="Paramètres du projet"
            open={sectionOpen.settings}
            onToggle={() => setSectionOpen((s) => ({ ...s, settings: !s.settings }))}
          >
            <div className="project-settings">
              <div className="rename-box">
                <label className="field">
                  <span>Renommer l’affichage</span>
                  <input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
                </label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void onRenameProject()}>
                  Enregistrer le nom
                </button>
              </div>
              <div className="stack-box">
                <div className="field stack-box-intro">
                  <span>Stack technique (agents Code Studio)</span>
                  <p className="hint stack-hint">
                    S’ajoute au message côté daemon : les agents doivent respecter cette stack sauf consigne explicite
                    contraire dans le chat. Un projet déjà configuré s’ouvre en « Personnalisé » avec le texte enregistré.
                  </p>
                </div>
                <StackFields
                  selectId="project-stack-select"
                  presetId={stackPresetId}
                  onPresetChange={onStackPresetSelect}
                  customText={stackCustomText}
                  onCustomTextChange={setStackCustomText}
                  addons={stackAddons}
                  onToggleAddon={toggleStackAddon}
                  composedStack={composedStack}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void onSaveTechStack()}>
                  Enregistrer la stack
                </button>
              </div>
            </div>
          </CollapsiblePanel>
        ) : null}

        <CollapsiblePanel
          title="Évolutions Git"
          open={sectionOpen.evolutions}
          onToggle={() => setSectionOpen((s) => ({ ...s, evolutions: !s.evolutions }))}
        >
          <p className="hint">Branche dédiée par idée ; fusion dans main depuis la barre du bas.</p>
          <label className="field">
            <span>Label de branche (optionnel)</span>
            <input
              value={evoLabel}
              onChange={(e) => setEvoLabel(e.target.value)}
              placeholder="ex. auth-login"
            />
          </label>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void onNewEvolution()}>
            Créer une branche studio/…
          </button>
          <ul className="evo-list">
            {evolutions.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={e.id === selectedEvoId ? "active" : ""}
                  onClick={() => setSelectedEvoId(e.id)}
                >
                  <span className="evo-branch">{e.branch}</span>
                  <span className="evo-status">{e.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </CollapsiblePanel>
      </aside>

      <div className="center">
        <div className="center-tabs" role="tablist" aria-label="Éditeur ou aperçu">
          <button
            type="button"
            role="tab"
            aria-selected={centerTab === "editor"}
            className={`center-tab ${centerTab === "editor" ? "active" : ""}`}
            onClick={() => setCenterTab("editor")}
          >
            Éditeur
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={centerTab === "preview"}
            className={`center-tab ${centerTab === "preview" ? "active" : ""}`}
            onClick={() => setCenterTab("preview")}
          >
            Aperçu
          </button>
        </div>
        {centerTab === "editor" ? (
          <div className="center-body editor-pane">
            <div className="pane-title">Éditeur {filePath ? <code>{filePath}</code> : null}</div>
            <CodeEditor path={filePath} value={editorText} onChange={setEditorText} />
            <p className="hint editor-hint">
              L’édition locale n’est pas renvoyée au daemon — utilisez le chat pour faire modifier l’agent.
            </p>
          </div>
        ) : (
          <div className="center-body preview-pane">
            <div className="preview-toolbar">
              <span className="pane-title-inline">Aperçu</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!selectedId || previewBusy}
                title="npm install si nécessaire, puis npm run dev (Vite, etc.)"
                onClick={() => void onPlayPreview()}
              >
                {previewBusy ? "Démarrage…" : "▶ Lancer la prévisualisation"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!selectedId || !devPreviewUrl}
                onClick={() => void onStopPreview()}
              >
                Arrêter le serveur
              </button>
            </div>
            {previewLog ? (
              <pre className="preview-install-log" title="Sortie npm install">
                {previewLog}
              </pre>
            ) : null}
            {devPreviewUrl || staticPreviewBlobUrl ? (
              <iframe
                className="preview-frame"
                title="Aperçu"
                src={devPreviewUrl ?? staticPreviewBlobUrl ?? undefined}
                sandbox={
                  devPreviewUrl
                    ? "allow-scripts allow-same-origin allow-forms allow-popups"
                    : "allow-scripts"
                }
              />
            ) : (
              <div className="preview-empty">
                <p>
                  <strong>Serveur de dev</strong> : cliquez sur « Lancer la prévisualisation » (projet avec{" "}
                  <code>package.json</code> et script <code>dev</code>). Le daemon exécute <code>npm install</code>{" "}
                  si <code>node_modules</code> est absent.
                </p>
                <p>
                  <strong>HTML statique</strong> : ouvrez un fichier <code>.html</code> dans l’arborescence, puis
                  revenez ici — l’aperçu s’affiche sans serveur.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ops-bar">
        <div className="ops-group">
          <span className="ops-label">Importer</span>
          <input
            className="ops-input"
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            placeholder="https://github.com/…"
          />
          <button type="button" className="btn btn-secondary" disabled={!selectedId} onClick={() => void onClone()}>
            Cloner (HTTPS)
          </button>
        </div>
        <div className="ops-group">
          <span className="ops-label">Build</span>
          <input
            className="ops-input"
            value={buildCmd}
            onChange={(e) => setBuildCmd(e.target.value)}
            placeholder="npm run build"
          />
          <button type="button" className="btn btn-primary" disabled={!selectedId} onClick={() => void onBuild()}>
            Exécuter
          </button>
        </div>
        <div className="ops-group">
          <button
            type="button"
            className="btn btn-secondary"
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
            Fusionner dans main
          </button>
          <button
            type="button"
            className="btn btn-ghost"
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
            Abandonner la branche
          </button>
        </div>
        {error ? <div className="banner banner-error">{error}</div> : null}
        {status ? <div className="banner banner-ok">{status}</div> : null}
      </div>

      <aside className="chat-panel" aria-hidden={!sidebarRightVisible}>
        <div className="pane-title">Message à l’agent</div>
        <label className="field agent-select">
          <span>Rôle de l’agent</span>
          <select value={agent} onChange={(e) => setAgent(e.target.value)}>
            {AGENT_OPTIONS.map((o) => (
              <option key={o.value || "auto"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {agentHint ? <p className="hint agent-hint">{agentHint}</p> : null}
        {activeBranch ? (
          <div className="branch-pill">
            Branche active : <code>{activeBranch}</code>
          </div>
        ) : (
          <p className="hint">Aucune branche d’évolution sélectionnée — les changements suivent la branche Git courante du dossier.</p>
        )}

        {taskTrace ? (
          <div className={`task-trace ${taskTrace.done ? "done" : "running"}`}>
            <div className="task-trace-title">Suivi de la dernière tâche</div>
            <div className="task-trace-id">
              ID <code>{taskTrace.id.slice(0, 8)}…</code> — {formatTaskStatusFr(taskTrace.status)}
            </div>
            <div className="task-trace-line">{taskTrace.line}</div>
            {!taskTrace.done ? <div className="task-spinner">Mise à jour…</div> : null}
          </div>
        ) : (
          <div className="task-trace idle">
            <div className="task-trace-title">Suivi de tâche</div>
            <p className="hint">Après envoi, l’état du daemon s’affiche ici (polling ~1,5 s).</p>
          </div>
        )}

        <div className="chat-log">
          {chat.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="chat-form">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Décrivez ce que l’agent doit créer ou modifier… (Entrée pour nouvelle ligne)"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void onSendChat();
              }
            }}
          />
          <button type="button" className="btn btn-primary" disabled={!selectedId} onClick={() => void onSendChat()}>
            Envoyer
          </button>
        </div>
        <p className="kbd-hint">Raccourci : <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> pour envoyer</p>

        <div className="pane-title">Journal de build</div>
        <pre className="build-pre">{buildLog || "—"}</pre>
      </aside>

      {modalLoadOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setModalLoadOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setModalLoadOpen(false)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-load-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="modal-load-title">Charger un projet</h3>
            <p className="hint">Sélectionnez un projet existant sur ce poste (via le daemon).</p>
            {projects.length === 0 ? (
              <p className="hint">Aucun projet — créez-en un d’abord.</p>
            ) : (
              <ul className="project-list modal-project-list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`project-item ${p.id === selectedId ? "active" : ""}`}
                      data-testid={`studio-project-${p.id}`}
                      onClick={() => {
                        setSelectedId(p.id);
                        setModalLoadOpen(false);
                      }}
                    >
                      <span className="project-name">{p.name}</span>
                      <span className="project-id">{p.id.slice(0, 8)}…</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModalLoadOpen(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalCreateOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setModalCreateOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setModalCreateOpen(false)}
        >
          <div
            className="modal-card modal-card--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="modal-create-title">Nouveau projet</h3>
            <p className="hint">Un dépôt Git local est initialisé automatiquement dans le dossier du projet.</p>
            <label className="field">
              <span>Nom du projet</span>
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Ex. Landing vitrine"
              />
            </label>
            <div className="new-project-stack">
              <span className="field-label-like">Stack à la création (optionnel)</span>
              <StackFields
                selectId="modal-new-project-stack-select"
                presetId={newStackPresetId}
                onPresetChange={onNewStackPresetSelect}
                customText={newStackCustomText}
                onCustomTextChange={setNewStackCustomText}
                addons={newStackAddons}
                onToggleAddon={toggleNewStackAddon}
                composedStack={newProjectComposedStack}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModalCreateOpen(false)}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void onCreateProject()}>
                Créer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
