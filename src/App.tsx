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
    hint: "Structure minimale (README, manifeste, entrées) selon la stack du projet ou le message utilisateur.",
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
  className,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={["panel", "panel-collapsible", className].filter(Boolean).join(" ")}>
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

/** Dernière ligne de progression trop générique pour la remplacer par un texte fixe (voir daemon `task_progress_is_chat_stub`). */
function isStubProgressMessage(msg: string): boolean {
  const t = msg.trim();
  if (t.length === 0) return true;
  const stubs = new Set([
    "Terminé.",
    "Done.",
    "Échec.",
    "Annulé.",
    "Failed.",
    "Cancelled.",
    "Sous-tâches en cours.",
  ]);
  if (stubs.has(t)) return true;
  if (t.startsWith("Task delegated to agent")) return true;
  return false;
}

/** Texte affiché dans le chat à la fin du suivi de tâche (préfère la dernière progression substantive renvoyée par le daemon). */
function chatMessageForTerminalTask(status: string, lastProgressMessage: string | undefined): string {
  const last = lastProgressMessage?.trim();
  if (status === "completed") {
    if (last && !isStubProgressMessage(last)) {
      return last;
    }
    return "La tâche est terminée. Les nouveaux fichiers apparaissent dans l’arborescence (rafraîchissement automatique).";
  }
  if (status === "failed") {
    if (last && !isStubProgressMessage(last)) {
      return last;
    }
    return "La tâche a échoué (vérif automatique build/check ou erreur agent) — voir le suivi ci-dessus ou les logs du daemon.";
  }
  if (status === "waiting_user_input") {
    return "Le daemon attend une validation (approbation d’outil ou question utilisateur).";
  }
  return `État : ${formatTaskStatusFr(status)}`;
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
  /** Dernière version connue sur le daemon (après ouverture ou enregistrement réussi). */
  const [savedEditorText, setSavedEditorText] = useState("");
  /** Fichier ouvert en mode binaire (pas de champ `content` dans la réponse raw). */
  const [editorBinary, setEditorBinary] = useState(false);
  /** Aperçu HTML statique (blob) depuis un fichier ouvert. */
  const [staticPreviewBlobUrl, setStaticPreviewBlobUrl] = useState<string | null>(null);
  /** URL du serveur dev lancé par le daemon (`npm run dev`). */
  const [devPreviewUrl, setDevPreviewUrl] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<"editor" | "preview" | "logs">("editor");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewLog, setPreviewLog] = useState("");
  const [forceInstallBeforePreview, setForceInstallBeforePreview] = useState(false);
  const [devServerLog, setDevServerLog] = useState("");
  const [depsInstallBusy, setDepsInstallBusy] = useState(false);
  const [gitHeadBranch, setGitHeadBranch] = useState<string | null>(null);
  const [gitWorktreeClean, setGitWorktreeClean] = useState<boolean | null>(null);
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
  const [taskTraceSectionOpen, setTaskTraceSectionOpen] = useState(true);
  /** Annule le polling en cours (nouveau message ou démontage du composant). */
  const pollTaskAbortRef = useRef<AbortController | null>(null);
  const editorDirtyRef = useRef(false);
  const filePathRef = useRef<string | null>(null);
  const editorBinaryRef = useRef(false);

  const [modalCreateOpen, setModalCreateOpen] = useState(false);
  const [modalLoadOpen, setModalLoadOpen] = useState(false);
  const [sidebarLeftVisible, setSidebarLeftVisible] = useState(true);
  const [sidebarRightVisible, setSidebarRightVisible] = useState(true);
  const [sectionOpen, setSectionOpen] = useState({
    project: true,
    files: true,
    settings: false,
    ops: true,
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

  const editorDirty = useMemo(
    () => Boolean(filePath && !editorBinary && editorText !== savedEditorText),
    [filePath, editorBinary, editorText, savedEditorText],
  );

  useEffect(() => {
    editorDirtyRef.current = editorDirty;
  }, [editorDirty]);
  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);
  useEffect(() => {
    editorBinaryRef.current = editorBinary;
  }, [editorBinary]);

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
      setGitHeadBranch(null);
      setGitWorktreeClean(null);
      return;
    }
    let cancelled = false;
    void api
      .getProjectMeta(selectedId)
      .then((m) => {
        if (cancelled) return;
        setGitHeadBranch(m.git_branch ?? null);
        setGitWorktreeClean(m.git_worktree_clean ?? null);
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
          setGitHeadBranch(null);
          setGitWorktreeClean(null);
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
      setSavedEditorText("");
      setEditorBinary(false);
      setStaticPreviewBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setDevPreviewUrl(null);
      setEvolutions([]);
      return;
    }
    let cancelled = false;
    setFilePath(null);
    setEditorText("");
    setSavedEditorText("");
    setEditorBinary(false);
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

  const reloadOpenFileFromServer = useCallback(async () => {
    if (!selectedId || !filePath || editorBinary) return;
    try {
      const raw = await api.readRawFile(selectedId, filePath);
      const text = raw.content ?? "";
      setEditorText(text);
      setSavedEditorText(text);
      const ext = filePath.toLowerCase();
      if (ext.endsWith(".html") || ext.endsWith(".htm")) {
        const blob = new Blob([text], { type: "text/html" });
        setStaticPreviewBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      }
    } catch {
      /* ignore */
    }
  }, [selectedId, filePath, editorBinary]);

  const refreshFiles = useCallback(async () => {
    if (!selectedId) return;
    setError(null);
    try {
      const f = await api.listFiles(selectedId);
      setFiles(f);
      let metaNote = "";
      try {
        const m = await api.getProjectMeta(selectedId);
        setGitHeadBranch(m.git_branch ?? null);
        setGitWorktreeClean(m.git_worktree_clean ?? null);
      } catch {
        /* ignore */
      }
      if (filePath && f.includes(filePath) && !editorBinary) {
        if (editorDirty) {
          metaNote = " — éditeur non rechargé (fichier modifié localement)";
        } else {
          await reloadOpenFileFromServer();
        }
      }
      setStatus(`Fichiers actualisés${metaNote}`);
    } catch (e) {
      setError(String(e));
    }
  }, [selectedId, filePath, editorBinary, editorDirty, reloadOpenFileFromServer]);

  const onPlayPreview = useCallback(async () => {
    if (!selectedId) return;
    setPreviewBusy(true);
    setPreviewLog("");
    setError(null);
    try {
      const r = await api.startStudioPreview(selectedId, { force_install: forceInstallBeforePreview });
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
  }, [selectedId, forceInstallBeforePreview]);

  const onInstallDepsOnly = useCallback(async () => {
    if (!selectedId) return;
    setDepsInstallBusy(true);
    setError(null);
    setPreviewLog("");
    try {
      const r = await api.installStudioDeps(selectedId, { force: true });
      if (r.skipped) {
        setPreviewLog(`Dépendances déjà présentes (${r.reason ?? "node_modules"}).`);
        setStatus("node_modules déjà installé");
      } else if (r.install) {
        const { stdout, stderr, exit_code } = r.install;
        setPreviewLog(
          [`Code: ${exit_code}`, stdout, stderr].filter(Boolean).join("\n\n"),
        );
        setStatus(r.ok ? "npm install terminé" : "npm install a échoué — voir le journal ci-dessous");
      }
      setCenterTab("preview");
    } catch (e) {
      setError(String(e));
    } finally {
      setDepsInstallBusy(false);
    }
  }, [selectedId]);

  const onStopPreview = useCallback(async () => {
    if (!selectedId) return;
    setError(null);
    try {
      await api.stopStudioPreview(selectedId);
      setDevPreviewUrl(null);
      setDevServerLog("");
      setStatus("Prévisualisation arrêtée");
    } catch (e) {
      setError(String(e));
    }
  }, [selectedId]);

  const openFile = useCallback(
    async (path: string) => {
      if (!selectedId) return;
      if (filePath && editorDirty) {
        const ok = window.confirm(
          "Des modifications non enregistrées dans le fichier ouvert seront perdues. Continuer ?",
        );
        if (!ok) return;
      }
      setError(null);
      setFilePath(path);
      try {
        const raw = await api.readRawFile(selectedId, path);
        const text = raw.content;
        const isBinary = text === undefined && Boolean(raw.content_base64);
        if (isBinary) {
          setEditorBinary(true);
          setEditorText("(binaire — enregistrement depuis l’éditeur non disponible)");
          setSavedEditorText("");
          setStaticPreviewBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        } else {
          setEditorBinary(false);
          const body = text ?? "";
          setEditorText(body);
          setSavedEditorText(body);
          const ext = path.toLowerCase();
          if (ext.endsWith(".html") || ext.endsWith(".htm")) {
            const blob = new Blob([body], { type: "text/html" });
            setStaticPreviewBlobUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(blob);
            });
          } else {
            setStaticPreviewBlobUrl(null);
          }
        }
      } catch (e) {
        setError(String(e));
      }
    },
    [selectedId, filePath, editorDirty],
  );

  const saveEditor = useCallback(async () => {
    if (!selectedId || !filePath || editorBinary || !editorDirty) return;
    setError(null);
    try {
      await api.writeRawFile(selectedId, filePath, editorText);
      setSavedEditorText(editorText);
      const ext = filePath.toLowerCase();
      if (ext.endsWith(".html") || ext.endsWith(".htm")) {
        const blob = new Blob([editorText], { type: "text/html" });
        setStaticPreviewBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      }
      setStatus(`Fichier enregistré : ${filePath}`);
    } catch (e) {
      setError(String(e));
    }
  }, [selectedId, filePath, editorBinary, editorDirty, editorText]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "s" && e.key !== "S") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (centerTab !== "editor") return;
      if (!filePath || editorBinary || !editorDirty) return;
      e.preventDefault();
      void saveEditor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [centerTab, filePath, editorBinary, editorDirty, saveEditor]);

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
    async (taskId: string, signal: AbortSignal) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      try {
        while (!signal.aborted) {
          const t = await api.getTask(taskId);
          if (signal.aborted) return;
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
                const fl = await api.listFiles(selectedId);
                setFiles(fl);
                const fp = filePathRef.current;
                if (
                  fp
                  && fl.includes(fp)
                  && !editorDirtyRef.current
                  && !editorBinaryRef.current
                ) {
                  try {
                    const raw = await api.readRawFile(selectedId, fp);
                    const text = raw.content ?? "";
                    setEditorText(text);
                    setSavedEditorText(text);
                    const ext = fp.toLowerCase();
                    if (ext.endsWith(".html") || ext.endsWith(".htm")) {
                      const blob = new Blob([text], { type: "text/html" });
                      setStaticPreviewBlobUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return URL.createObjectURL(blob);
                      });
                    }
                  } catch {
                    /* ignore */
                  }
                }
              } catch {
                /* ignore */
              }
            }
            const summary = chatMessageForTerminalTask(t.status, last?.message);
            setChat((c) => [...c, { role: "assistant", text: summary }]);
            return;
          }
          await sleep(1500);
        }
      } catch (e) {
        if (signal.aborted) return;
        setTaskTrace((prev) =>
          prev ? { ...prev, line: `Erreur de suivi : ${e}`, done: true } : null,
        );
      }
    },
    [selectedId],
  );

  useEffect(
    () => () => {
      pollTaskAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!selectedId || centerTab !== "logs") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const j = await api.getPreviewLogs(selectedId);
        if (!cancelled) setDevServerLog(j.log ?? "");
      } catch {
        if (!cancelled) setDevServerLog("");
      }
    };
    void tick();
    const id = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedId, centerTab]);

  const onRegeneratePlan = useCallback(async () => {
    if (!selectedId) return;
    const msg = `[Tâche Code Studio — plan projet]
Le fichier CODE_STUDIO_PLAN.md est absent ou doit être réinitialisé. Analyse la structure du dépôt (fichiers, stack, scripts), puis crée ou remplace CODE_STUDIO_PLAN.md à la racine avec : titre du projet, stack observée, objectif, étapes, et historique des changements (ce que tu déduis du code existant). N’invente pas de fonctionnalités non présentes dans les fichiers.`;
    setChat((c) => [...c, { role: "user", text: msg }]);
    setError(null);
    pollTaskAbortRef.current?.abort();
    setTaskTrace(null);
    try {
      const { task_id } = await api.sendMessage({
        message: msg,
        studio_project_id: selectedId,
        studio_assigned_agent: agent || undefined,
        studio_evolution_id: selectedEvoId ?? undefined,
        studio_evolution_branch: activeBranch ?? undefined,
      });
      const ac = new AbortController();
      pollTaskAbortRef.current = ac;
      setTaskTrace({
        id: task_id,
        status: "queued",
        line: "Régénération du plan…",
        done: false,
      });
      void pollTask(task_id, ac.signal);
    } catch (e) {
      setError(String(e));
    }
  }, [selectedId, agent, selectedEvoId, activeBranch, pollTask]);

  const onSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !selectedId) return;
    setChat((c) => [...c, { role: "user", text }]);
    setChatInput("");
    setError(null);
    pollTaskAbortRef.current?.abort();
    setTaskTrace(null);
    try {
      const { task_id } = await api.sendMessage({
        message: text,
        studio_project_id: selectedId,
        studio_assigned_agent: agent || undefined,
        studio_evolution_id: selectedEvoId ?? undefined,
        studio_evolution_branch: activeBranch ?? undefined,
      });
      const ac = new AbortController();
      pollTaskAbortRef.current = ac;
      setTaskTrace({
        id: task_id,
        status: "queued",
        line: "Requête acceptée par le daemon — démarrage…",
        done: false,
      });
      void pollTask(task_id, ac.signal);
    } catch (e) {
      setError(String(e));
    }
  };

  const agentHint = useMemo(() => {
    const opt = AGENT_OPTIONS.find((o) => o.value === agent);
    if (!opt) return "";
    if (agent === "studio_scaffold") {
      const stack = composedStack.trim();
      if (stack) {
        const s = stack.length > 320 ? `${stack.slice(0, 320)}…` : stack;
        return `Structure minimale alignée sur la stack enregistrée : ${s}`;
      }
      return opt.hint;
    }
    return opt.hint;
  }, [agent, composedStack]);

  const previewUrl = devPreviewUrl ?? staticPreviewBlobUrl;

  const openPreviewInNewWindow = useCallback(() => {
    if (!previewUrl) return;
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }, [previewUrl]);

  const appLayoutClass =
    "app" +
    (!sidebarLeftVisible ? " app--left-collapsed" : "") +
    (!sidebarRightVisible ? " app--right-collapsed" : "");

  return (
    <div className={appLayoutClass}>
      <header className="app-header app-header--compact">
        <div className="app-header-row">
          <h1>Code Studio</h1>
        </div>
      </header>

      <div className={`sidebar-column${!sidebarLeftVisible ? " sidebar-column--collapsed" : ""}`}>
        {sidebarLeftVisible ? (
        <aside className="sidebar">
          <div className="sidebar-scroll">
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
            <div className="file-list-scroll">
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
            </div>
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
          <p className="hint">
            Branche de travail isolée pour une évolution (idée ou feature) ; fusionnez vers la branche principale depuis « Import & build ».
          </p>
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

        <CollapsiblePanel
          title="Import & build"
          open={sectionOpen.ops}
          onToggle={() => setSectionOpen((s) => ({ ...s, ops: !s.ops }))}
        >
          <div className="ops-panel">
            <div className="ops-group ops-group--stacked">
              <label className="field">
                <span>URL du dépôt (HTTPS)</span>
                <input
                  className="ops-input"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/…"
                  title="Adresse Git distante à cloner dans le dossier du projet (écrase ou fusionne selon le dépôt)."
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                disabled={!selectedId}
                title="Exécute git clone dans le répertoire du projet Code Studio pour récupérer le code d’un dépôt distant."
                onClick={() => void onClone()}
              >
                Cloner (HTTPS)
              </button>
            </div>
            <div className="ops-group ops-group--stacked">
              <label className="field">
                <span>Commande de build</span>
                <input
                  className="ops-input"
                  value={buildCmd}
                  onChange={(e) => setBuildCmd(e.target.value)}
                  placeholder="npm run build"
                  title="Ligne de commande exécutée dans le dossier projet (ex. npm run build, cargo build)."
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={!selectedId}
                title="Lance la commande sur le serveur Akasha et affiche la sortie dans le journal de build (panneau droit)."
                onClick={() => void onBuild()}
              >
                Exécuter le build
              </button>
            </div>
            <div className="ops-group ops-group--stacked">
              <button
                type="button"
                className="btn btn-secondary btn-block"
                disabled={!selectedId || !selectedEvoId}
                title="Fusionne la branche de travail sélectionnée dans la branche principale (main ou master, côté daemon)."
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
                className="btn btn-ghost btn-block"
                disabled={!selectedId || !selectedEvoId}
                title="Abandonne la branche de travail sans fusion (suppression côté daemon selon la logique Git)."
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
        </CollapsiblePanel>
          </div>
        </aside>
        ) : null}
        <button
          type="button"
          className="sidebar-split-toggle sidebar-split-toggle--left"
          aria-expanded={sidebarLeftVisible}
          title={
            sidebarLeftVisible
              ? "Masquer le panneau gauche (replie vers la gauche)"
              : "Afficher le panneau gauche"
          }
          onClick={() => setSidebarLeftVisible((v) => !v)}
        >
          {sidebarLeftVisible ? "◀" : "▶"}
        </button>
      </div>

      <div className="center">
        <div className="center-tabs" role="tablist" aria-label="Éditeur, aperçu ou logs">
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
          <button
            type="button"
            role="tab"
            aria-selected={centerTab === "logs"}
            className={`center-tab ${centerTab === "logs" ? "active" : ""}`}
            onClick={() => setCenterTab("logs")}
          >
            Logs serveur
          </button>
        </div>
        {centerTab === "editor" ? (
          <div className="center-body editor-pane">
            <div className="editor-toolbar">
              <span className="pane-title-inline">Éditeur</span>
              {filePath ? (
                <code className="editor-open-path" title={filePath}>
                  {filePath}
                </code>
              ) : null}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                data-testid="studio-save-file"
                disabled={!selectedId || !filePath || editorBinary || !editorDirty}
                title="Enregistrer sur le disque du projet (Ctrl+S ou Cmd+S)"
                onClick={() => void saveEditor()}
              >
                Enregistrer
              </button>
            </div>
            <CodeEditor path={filePath} value={editorText} onChange={setEditorText} />
            <p className="hint editor-hint">
              Les fichiers texte peuvent être enregistrés sur le disque du projet (bouton ou Ctrl+S). Le chat reste
              utile pour des changements plus larges ou revus par l’agent.
            </p>
          </div>
        ) : centerTab === "preview" ? (
          <div className="center-body preview-pane">
            <div className="preview-toolbar">
              <span className="pane-title-inline">Aperçu</span>
              <label className="preview-checkbox" title="Relance npm install avant le serveur (utile après changement de dépendances).">
                <input
                  type="checkbox"
                  checked={forceInstallBeforePreview}
                  onChange={(e) => setForceInstallBeforePreview(e.target.checked)}
                />
                Forcer npm install
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!selectedId || depsInstallBusy}
                title="Exécute uniquement npm install dans le dossier projet (sans démarrer le serveur)."
                onClick={() => void onInstallDepsOnly()}
              >
                {depsInstallBusy ? "Installation…" : "Installer les dépendances"}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!selectedId || previewBusy}
                title="npm install si nécessaire (ou forcé), puis npm run dev (Vite, etc.)"
                onClick={() => void onPlayPreview()}
              >
                {previewBusy ? "Démarrage…" : "▶ Lancer la prévisualisation"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!selectedId || !devPreviewUrl}
                title="Arrête le serveur de développement lancé par le daemon."
                onClick={() => void onStopPreview()}
              >
                Arrêter le serveur
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!previewUrl}
                title="Ouvre l’URL d’aperçu (serveur dev ou fichier HTML) dans un nouvel onglet ou une nouvelle fenêtre du navigateur."
                onClick={() => openPreviewInNewWindow()}
              >
                Nouvelle fenêtre
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
        ) : (
          <div className="center-body preview-pane preview-pane--logs">
            <div className="preview-toolbar">
              <span className="pane-title-inline">Logs du serveur de dev</span>
              <p className="hint preview-logs-hint">
                Sortie standard et erreurs du processus <code>npm run dev</code> (Vite, etc.). Ouvrez cet onglet pour voir les erreurs de compilation ou du backend qui n’apparaissent pas dans l’iframe.
              </p>
            </div>
            <pre className="preview-dev-log" title="Logs du serveur">
              {devServerLog || "— (lancez la prévisualisation puis revenez ici — rafraîchissement automatique)"}
            </pre>
          </div>
        )}
      </div>

      <div className={`chat-column${!sidebarRightVisible ? " chat-column--collapsed" : ""}`}>
        {sidebarRightVisible ? (
        <aside className="chat-panel">
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
        <div className="branch-pill branch-pill--stacked">
          <div>
            Branche Git actuelle (dépôt local) :{" "}
            <code title="git rev-parse --abbrev-ref HEAD">{gitHeadBranch ?? "—"}</code>
            {gitWorktreeClean === false ? (
              <span className="hint"> — modifications non commitées</span>
            ) : null}
            {gitWorktreeClean === true ? (
              <span className="hint"> — arbre de travail propre</span>
            ) : null}
          </div>
          {activeBranch ? (
            <div>
              Branche de travail <strong>Code Studio</strong> sélectionnée : <code>{activeBranch}</code> (les messages agent utilisent cette branche si le dépôt est dessus).
            </div>
          ) : (
            <p className="hint">
              Aucune branche de travail isolée sélectionnée : les messages à l’agent s’appliquent à la branche Git affichée ci-dessus. Créez une branche ci-contre (« Évolutions Git ») pour isoler une évolution.
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-block"
          disabled={!selectedId}
          title="Envoie une consigne à l’agent pour créer ou remplir CODE_STUDIO_PLAN.md"
          onClick={() => void onRegeneratePlan()}
        >
          Initialiser / régénérer le plan (CODE_STUDIO_PLAN.md)
        </button>

        <CollapsiblePanel
          className="chat-task-trace-wrap"
          title="Suivi de la dernière tâche"
          open={taskTraceSectionOpen}
          onToggle={() => setTaskTraceSectionOpen((v) => !v)}
        >
          <div className="task-trace-scroll">
            {taskTrace ? (
              <div
                className={`task-trace ${taskTrace.done ? "done" : "running"}`}
                data-task-status={taskTrace.status}
              >
                <div className="task-trace-header-row">
                  <span className={`task-trace-badge task-trace-badge--${taskTrace.done ? "final" : "live"}`}>
                    {taskTrace.done ? "État final" : "En cours"}
                  </span>
                </div>
                <div className="task-trace-id">
                  ID <code>{taskTrace.id.slice(0, 8)}…</code> — {formatTaskStatusFr(taskTrace.status)}
                </div>
                <div className="task-trace-line">{taskTrace.line}</div>
                {!taskTrace.done ? <div className="task-spinner">Mise à jour…</div> : null}
              </div>
            ) : (
              <div className="task-trace idle">
                <p className="hint task-trace-idle-hint">
                  Après envoi, l’état du daemon s’affiche ici (polling ~1,5 s) jusqu’à un état final ou une attente
                  utilisateur.
                </p>
              </div>
            )}
          </div>
        </CollapsiblePanel>

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
        ) : null}
        <button
          type="button"
          className="sidebar-split-toggle sidebar-split-toggle--right"
          aria-expanded={sidebarRightVisible}
          title={sidebarRightVisible ? "Masquer le panneau chat (replie vers la droite)" : "Afficher le panneau chat"}
          onClick={() => setSidebarRightVisible((v) => !v)}
        >
          {sidebarRightVisible ? "▶" : "◀"}
        </button>
      </div>

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
