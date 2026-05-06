import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import { loadChatMessages, saveChatMessages, type ChatMessage } from "./chatStorage";
import { clearActiveTask, loadActiveTask, saveActiveTask } from "./taskStorage";
import { clearLastProjectId, getLastProjectId, setLastProjectId } from "./lastProjectStorage";
import {
  STACK_PRESET_CUSTOM,
  STACK_PRESET_NONE,
  type StackAddonCategoryId,
  composeStackString,
  emptyStackAddons,
} from "./stackConfig";
import { AgentCapabilitiesTable } from "./agentCapabilities";
import { CodeEditor } from "./codeEditor";
import { DevServerLogView } from "./devServerLogView";
import { inferActionRisk, riskLabel, type ActionRiskLevel } from "./inferActionRisk";
import { MarkdownBlock } from "./markdownBlock";
import { CODE_MODE_OPTIONS, loadPersistedCodeMode, persistCodeMode } from "./studioConstants";
import type { StudioCodeMode } from "./api";
import {
  buildDesignPolicyHint,
  DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN,
  DESIGN_DOC_AGENT_STUDIO_HINT_COMPACT_EN,
  designTokensToCss,
  designTokensToJson,
  normalizeDesignDoc,
  parseDesignDoc,
} from "./designDoc";
import { DesignVisualBoard } from "./designVisualBoard";
import { EditorFileTree } from "./editorFileTree";
import {
  TaskDetailEventsGrouped,
  TaskDetailProgressView,
  TaskDetailWorkflowView,
  mergeProgressWithEventProgress,
} from "./taskDetailUi";
import { ChatStudioDiffPanel } from "./chatStudioDiff";
import { DaemonOpsPanel } from "./daemonOpsPanel";
import { TooltipHint } from "./tooltipHint";
import { Sidebar, getTabsForGroup, getDefaultGroup, getGroupForTab } from "./sidebar";
import { ProjectDashboard } from "./projectDashboard";
import { Accordion, type AccordionItem } from "./accordion";
import { StackWizard } from "./stackWizard";

const AGENT_OPTIONS: { value: string; label: string; hint: string }[] = [
  {
    value: "",
    label: "Automatique",
    hint: "Le daemon route vers le chef de projet Code Studio ; la liste ci-dessous sert de préférence pour les sous-agents délégués.",
  },
  {
    value: "studio_scaffold",
    label: "Squelette d’app",
    hint: "Préférence sous-agent : structure minimale (README, manifeste, entrées) selon la stack du projet.",
  },
  {
    value: "studio_frontend",
    label: "Frontend",
    hint: "Préférence sous-agent : composants UI, styles, accessibilité, routing client.",
  },
  {
    value: "studio_backend",
    label: "Backend",
    hint: "Préférence sous-agent : API, persistance légère, CORS, configuration.",
  },
  {
    value: "studio_fullstack",
    label: "Full-stack",
    hint: "Préférence sous-agent : frontend + backend cohérents dans un même passage.",
  },
  {
    value: "studio_planner",
    label: "Planification (lecture seule)",
    hint: "Préférence sous-agent : explorer le dépôt et mettre à jour CODE_STUDIO_PLAN.md uniquement.",
  },
];

type CenterTab = "dashboard" | "editor" | "preview" | "plan" | "design" | "branches" | "logs" | "cockpit" | "docs" | "settings";

export type { CenterTab };

const CENTER_TAB_ITEMS: { id: CenterTab; label: string; testId?: string }[] = [
  { id: "dashboard", label: "Tableau de bord" },
  { id: "editor", label: "Éditeur" },
  { id: "preview", label: "Aperçu" },
  { id: "plan", label: "Plan" },
  { id: "design", label: "Design" },
  { id: "branches", label: "Branches", testId: "studio-branches-tab" },
  { id: "logs", label: "Logs serveur" },
  { id: "cockpit", label: "Cockpit" },
  { id: "docs", label: "Documentation", testId: "studio-doc-tab" },
  { id: "settings", label: "Paramètres", testId: "studio-settings-tab" },
];

const CENTER_TAB_STORAGE_KEY = "studio.centerTab";

function loadPersistedCenterTab(): CenterTab {
  if (typeof window === "undefined") return "dashboard";
  try {
    const stored = window.localStorage.getItem(CENTER_TAB_STORAGE_KEY);
    if (!stored) return "dashboard";
    const allowed = new Set<CenterTab>(CENTER_TAB_ITEMS.map((t) => t.id));
    return allowed.has(stored as CenterTab) ? (stored as CenterTab) : "dashboard";
  } catch {
    return "dashboard";
  }
}

// Deprecated: Use StackWizard instead
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// Deprecated: StackFields and StackFieldsProps have been replaced by StackWizard component

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

function looksLikeTimeoutMessage(msg: string): boolean {
  const t = msg.toLowerCase();
  return (
    t.includes("timeout") ||
    t.includes("timed out") ||
    t.includes("délai") ||
    t.includes("delai") ||
    t.includes("deadline") ||
    t.includes("etimedout") ||
    t.includes("504") ||
    t.includes("408")
  );
}

function looksLikeStructuredRefusal(text: string): boolean {
  const t = text.trim();
  if (/^refus\b/i.test(t)) return true;
  if (/^acceptation\b/i.test(t)) return false;
  return (
    t.includes("Refus :") ||
    t.includes("Refus collectif") ||
    t.includes("merci d'arrêter") ||
    t.includes("merci d'arrêter cette action")
  );
}

/** Texte affiché dans le chat à la fin du suivi de tâche (préfère la dernière progression substantive renvoyée par le daemon). */
function chatMessageForTerminalTask(
  status: string,
  lastProgressMessage: string | undefined,
  failureDetail?: string | null,
): string {
  const last = lastProgressMessage?.trim();
  const detail = failureDetail?.trim();
  if (status === "completed") {
    if (last && !isStubProgressMessage(last)) {
      return last;
    }
    return "La tâche est terminée. Les nouveaux fichiers apparaissent dans l’arborescence (rafraîchissement automatique).";
  }
  if (status === "failed") {
    const body =
      detail && (!last || isStubProgressMessage(last))
        ? detail
        : last && !isStubProgressMessage(last)
          ? last
          : detail || null;
    if (body) {
      const hint = looksLikeTimeoutMessage(body)
        ? "\n\n(Souvent un timeout réseau ou LLM — vous pouvez renvoyer la même consigne pour relancer.)"
        : "";
      return body.length > 2800 ? `${body.slice(0, 2800)}…${hint}` : `${body}${hint}`;
    }
    return "Échec sans détail persisté. Vérifiez l’onglet « Logs serveur », le journal de build, ou renvoyez la consigne pour une nouvelle tentative.";
  }
  if (status === "cancelled") {
    if (detail && (!last || isStubProgressMessage(last))) return detail;
    if (last && !isStubProgressMessage(last)) return last;
    return "La tâche a été annulée.";
  }
  if (status === "waiting_user_input") {
    return "Le daemon attend une validation (approbation d’outil ou question utilisateur).";
  }
  return `État : ${formatTaskStatusFr(status)}`;
}

function isMarkdownPath(path: string | null): boolean {
  if (!path) return false;
  const p = path.toLowerCase();
  return p.endsWith(".md") || p.endsWith(".markdown") || p.endsWith(".mdx");
}

function dedupeProgressForTrace(
  progress: { progress_pct: number; message: string; task_id?: string | null }[],
  taskId: string,
): { progress_pct: number; message: string; task_id?: string | null }[] {
  const deduped = new Map<string, { progress_pct: number; message: string; task_id?: string | null }>();
  for (const p of progress) {
    const raw = (p.message ?? "").trim();
    if (!raw) continue;
    // Streamed progress emits many near-identical updates for the same percentage.
    // Keep only the latest message per (task_id, progress_pct).
    const k = `${p.task_id ?? taskId}\0${p.progress_pct}`;
    deduped.set(k, p);
  }
  return Array.from(deduped.values()).sort((a, b) => a.progress_pct - b.progress_pct);
}

export default function App() {
  const [projects, setProjects] = useState<api.StudioProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof localStorage !== "undefined") {
      try {
        const saved = localStorage.getItem("akasha-studio-sidebar-open");
        return saved === null ? true : saved === "1";
      } catch {
        return true;
      }
    }
    return true;
  });
  const [activeGroup, setActiveGroup] = useState<string>(getDefaultGroup());
  const [newProjectName, setNewProjectName] = useState("Mon application");
  const [newProjectSummary, setNewProjectSummary] = useState("");
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
  const [centerTab, setCenterTab] = useState<CenterTab>(() => loadPersistedCenterTab());
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewLog, setPreviewLog] = useState("");
  const [forceInstallBeforePreview, setForceInstallBeforePreview] = useState(false);
  const [devServerLog, setDevServerLog] = useState("");
  const [depsInstallBusy, setDepsInstallBusy] = useState(false);
  const [gitHeadBranch, setGitHeadBranch] = useState<string | null>(null);
  const [gitWorktreeClean, setGitWorktreeClean] = useState<boolean | null>(null);
  const [gitWorktreeLines, setGitWorktreeLines] = useState<{ status: string; path: string }[]>([]);
  const [gitBranches, setGitBranches] = useState<api.GitBranchEntry[]>([]);
  const [gitBranchesLoading, setGitBranchesLoading] = useState(false);
  const [gitCompareBase, setGitCompareBase] = useState("");
  const [gitCompareTarget, setGitCompareTarget] = useState("");
  const [gitCompareResult, setGitCompareResult] = useState<api.GitComparePayload | null>(null);
  const [gitConflicts, setGitConflicts] = useState<string[]>([]);
  const [gitMergeInProgress, setGitMergeInProgress] = useState(false);
  /** Index code-RAG (recherche / contexte agent) pour le projet sélectionné. */
  const [codeRagStatus, setCodeRagStatus] = useState<api.CodeRagStatus | null>(null);
  const [codeRagStatusLoading, setCodeRagStatusLoading] = useState(false);
  const [codeRagStatusError, setCodeRagStatusError] = useState<string | null>(null);
  const [codeRagReindexBusy, setCodeRagReindexBusy] = useState(false);
  const [dashboardLastSyncAt, setDashboardLastSyncAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [buildCmd, setBuildCmd] = useState("npm run build");
  const [buildLog, setBuildLog] = useState("");
  const [evolutions, setEvolutions] = useState<api.Evolution[]>([]);
  const [evoLabel, setEvoLabel] = useState("");
  const [selectedEvoId, setSelectedEvoId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [forkDialog, setForkDialog] = useState<{
    open: boolean;
    index: number;
    parentTaskId: string;
    sourceText: string;
  } | null>(null);
  const [forkInitialInstruction, setForkInitialInstruction] = useState("");
  const [agent, setAgent] = useState<string>("studio_scaffold");
  const [taskTrace, setTaskTrace] = useState<{
    id: string;
    status: string;
    line: string;
    done: boolean;
    /** Étiquettes courtes dérivées des progressions daemon. */
    progressChips?: string[];
  } | null>(null);
  /** Réponse attendue par le daemon (`ask_user`, approbation, …) — alimenté par GET …/human-input. */
  const [pendingHumanInput, setPendingHumanInput] = useState<{
    taskId: string;
    question: string;
    context: string;
    choices: string[] | null;
  } | null>(null);
  const [humanReplyDraft, setHumanReplyDraft] = useState("");
  const [humanReplyBusy, setHumanReplyBusy] = useState(false);
  /** Annule le polling en cours (nouveau message ou démontage du composant). */
  const pollTaskAbortRef = useRef<AbortController | null>(null);
  const editorDirtyRef = useRef(false);
  const filePathRef = useRef<string | null>(null);
  const editorBinaryRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  const [modalCreateOpen, setModalCreateOpen] = useState(false);
  const [modalLoadOpen, setModalLoadOpen] = useState(false);
  const [deleteProjectDialog, setDeleteProjectDialog] = useState<api.StudioProject | null>(null);
  const [deletePrecheck, setDeletePrecheck] = useState<api.StudioDeletePrecheck | null>(null);
  const [deletePrecheckLoading, setDeletePrecheckLoading] = useState(false);
  const [deleteProjectBusy, setDeleteProjectBusy] = useState(false);
  /** Répartition centre / chat : équilibré, plein centre, plein chat. */
  const [mainSplit, setMainSplit] = useState<"balanced" | "center" | "chat">("balanced");
  /** Menu header ouvert : null ou id section. */
  const [openHeaderMenu, setOpenHeaderMenu] = useState<null | "project" | "evolutions" | "ops" | "agent">(null);
  const [gitStatusPopoverOpen, setGitStatusPopoverOpen] = useState(false);
  const [designViewMode, setDesignViewMode] = useState<"split" | "visual" | "source">("split");
  const [taskDetailForId, setTaskDetailForId] = useState<string | null>(null);
  const [taskDetailLoading, setTaskDetailLoading] = useState(false);
  const [taskDetailError, setTaskDetailError] = useState<string | null>(null);
  const [taskDetailPayload, setTaskDetailPayload] = useState<{
    task: api.TaskStatusResponse;
    events: api.TaskEventEntry[];
  } | null>(null);
  const [taskDetailLiveMode, setTaskDetailLiveMode] = useState<"sse" | "polling" | null>(null);
  const [chatOptionsOpen, setChatOptionsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("studio.chatOptionsOpen") === "1";
  });
  const [chatSuggestionsOpen, setChatSuggestionsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("studio.chatSuggestionsOpen") === "1";
  });
  const [buildLogOpen, setBuildLogOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("studio.buildLogOpen") === "1";
  });
  const [taskDetailTab, setTaskDetailTab] = useState<"events" | "progress" | "workflow" | "summary">("events");
  const [uiTheme, setUiTheme] = useState<"dark" | "light" | "compact-dark">(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("studio.uiTheme") : null;
    return stored === "light" || stored === "compact-dark" ? stored : "dark";
  });
  const [uiDensity, setUiDensity] = useState<"normal" | "compact">(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("studio.uiDensity") : null;
    return stored === "compact" ? "compact" : "normal";
  });

  const [codeMode, setCodeMode] = useState<StudioCodeMode>(() => loadPersistedCodeMode());
  const [policyHintOneShot, setPolicyHintOneShot] = useState("");
  const [delegateSingleLevel, setDelegateSingleLevel] = useState(false);
  const [evolutionSummaryDraft, setEvolutionSummaryDraft] = useState("");
  const [projectSummaryDraft, setProjectSummaryDraft] = useState("");
  const [policyNotesDraft, setPolicyNotesDraft] = useState("");
  /** Definition of Done : texte libre ou JSON critères (réutilisé pour chaque envoi tant que non vide). */
  const [acceptanceCriteriaDraft, setAcceptanceCriteriaDraft] = useState("");
  const [planDocText, setPlanDocText] = useState("");
  const [planDocSnapshot, setPlanDocSnapshot] = useState("");
  const [planDocLoading, setPlanDocLoading] = useState(false);
  const [designDocText, setDesignDocText] = useState("");
  const [designDocSnapshot, setDesignDocSnapshot] = useState("");
  const [designDocLoading, setDesignDocLoading] = useState(false);
  const [autoApplyDesign, setAutoApplyDesign] = useState(true);
  const [editorMarkdownPreview, setEditorMarkdownPreview] = useState(false);
  const [planMarkdownPreview, setPlanMarkdownPreview] = useState(false);
  const [designMarkdownPreview, setDesignMarkdownPreview] = useState(false);
  const [pendingInbox, setPendingInbox] = useState<api.TaskHumanInputPayload[]>([]);
  const [showAgentMatrix, setShowAgentMatrix] = useState(false);
  /** Refus structurés consécutifs pour la même demande utilisateur (évite boucles côté agent). */
  const [humanRefusalStreak, setHumanRefusalStreak] = useState(0);
  const [daemonStatus, setDaemonStatus] = useState<api.DaemonStatus>({ ok: false, label: "Vérification…" });
  const [userGuideDoc, setUserGuideDoc] = useState("");
  const [userGuideLoading, setUserGuideLoading] = useState(false);
  const [userGuideError, setUserGuideError] = useState<string | null>(null);

  const skipChatSaveOnce = useRef(false);
  const appliedCssVarsRef = useRef<Set<string>>(new Set());
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const chatPinnedByUserRef = useRef(false);
  /** Buffers live events received before the initial task-detail fetch completes. */
  const taskDetailLiveSnapshotRef = useRef<api.TaskEventEntry[] | null>(null);
  /** Incremented each time openDeleteProjectDialog is called; guards against applying a stale
   *  precheck result to the wrong project when the user quickly opens deletion for another project
   *  before the first precheck request resolves. */
  const deletePrecheckGenRef = useRef(0);
  const [chatHasUnseen, setChatHasUnseen] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );
  const parsedDesignDoc = useMemo(() => parseDesignDoc(designDocText), [designDocText]);
  const designHint = useMemo(() => buildDesignPolicyHint(parsedDesignDoc), [parsedDesignDoc]);
  const userGuideToc = useMemo(() => {
    if (!userGuideDoc) return [];
    return userGuideDoc
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^#{1,3}\s+/.test(line))
      .map((line) => {
        const match = /^(#{1,3})\s+(.+)$/.exec(line);
        if (!match) return null;
        const level = match[1].length;
        const label = match[2].trim();
        const id = label
          .toLowerCase()
          .replace(/[`*_~()[\]{}<>]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
        return { level, label, id };
      })
      .filter((item): item is { level: number; label: string; id: string } => Boolean(item?.id));
  }, [userGuideDoc]);

  const composedStack = useMemo(
    () => composeStackString(stackPresetId, stackCustomText, stackAddons),
    [stackPresetId, stackCustomText, stackAddons],
  );

  const dashboardProjectMeta = useMemo<api.StudioProjectMeta | null>(() => {
    if (!selectedProject) return null;
    return {
      id: selectedProject.id,
      name: selectedProject.name,
      created_at: "",
      tech_stack: composedStack.trim() ? composedStack.trim() : null,
      git_branch: gitHeadBranch ?? null,
      git_worktree_clean: gitWorktreeClean ?? null,
      git_worktree_lines: gitWorktreeLines,
      project_summary: projectSummaryDraft.trim() ? projectSummaryDraft.trim() : null,
      evolution_summary: evolutionSummaryDraft.trim() ? evolutionSummaryDraft.trim() : null,
      policy_notes: policyNotesDraft.trim() ? policyNotesDraft.trim() : null,
    };
  }, [
    selectedProject,
    composedStack,
    gitHeadBranch,
    gitWorktreeClean,
    gitWorktreeLines,
    projectSummaryDraft,
    evolutionSummaryDraft,
    policyNotesDraft,
  ]);

  const dashboardActiveTask = useMemo(() => {
    if (!selectedId || !taskTrace || taskTrace.done) return null;
    const stored = loadActiveTask(selectedId);
    return {
      taskId: taskTrace.id,
      startedAt: stored?.startedAt ?? Date.now(),
    };
  }, [selectedId, taskTrace]);

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
  useEffect(() => {
    if (!isMarkdownPath(filePath)) setEditorMarkdownPreview(false);
  }, [filePath]);

  useEffect(() => {
    const root = document.documentElement;
    const prevKeys = appliedCssVarsRef.current;
    const newKeys = new Set<string>();
    for (const [k, v] of Object.entries(parsedDesignDoc.tokens.colors)) {
      const varName = `--design-color-${k}`;
      root.style.setProperty(varName, v);
      newKeys.add(varName);
    }
    for (const [k, v] of Object.entries(parsedDesignDoc.tokens.spacing)) {
      const varName = `--design-spacing-${k}`;
      root.style.setProperty(varName, v);
      newKeys.add(varName);
    }
    for (const [k, v] of Object.entries(parsedDesignDoc.tokens.rounded)) {
      const varName = `--design-rounded-${k}`;
      root.style.setProperty(varName, v);
      newKeys.add(varName);
    }
    if (parsedDesignDoc.tokens.colors.primary) {
      root.style.setProperty("--akasha-accent", parsedDesignDoc.tokens.colors.primary);
      newKeys.add("--akasha-accent");
    }
    for (const key of prevKeys) {
      if (!newKeys.has(key)) {
        root.style.removeProperty(key);
      }
    }
    appliedCssVarsRef.current = newKeys;
  }, [parsedDesignDoc]);

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

  const clearSessionSnapsForProject = useCallback((id: string) => {
    try {
      sessionStorage.removeItem(`akasha-plan-snap-${id}`);
      sessionStorage.removeItem(`akasha-design-snap-${id}`);
    } catch {
      /* private mode / quota */
    }
  }, []);

  const openDeleteProjectDialog = useCallback((p: api.StudioProject) => {
    setOpenHeaderMenu(null);
    setModalLoadOpen(false);
    setDeleteProjectDialog(p);
    setDeletePrecheck(null);
    setDeletePrecheckLoading(true);
    const gen = ++deletePrecheckGenRef.current;
    void api
      .getDeletePrecheck(p.id)
      .then((c) => {
        if (deletePrecheckGenRef.current !== gen) return;
        setDeletePrecheck(c);
      })
      .catch((e) => {
        if (deletePrecheckGenRef.current !== gen) return;
        setError(String(e));
        setDeleteProjectDialog(null);
      })
      .finally(() => {
        if (deletePrecheckGenRef.current !== gen) return;
        setDeletePrecheckLoading(false);
      });
  }, []);

  const onConfirmDeleteProject = useCallback(
    async (force: boolean) => {
      if (!deleteProjectDialog) return;
      setError(null);
      setDeleteProjectBusy(true);
      const id = deleteProjectDialog.id;
      try {
        try {
          await api.stopStudioPreview(id);
        } catch {
          /* déjà arrêté ou indisponible */
        }
        await api.deleteProject(id, force);
        clearSessionSnapsForProject(id);
        if (selectedId === id) {
          setSelectedId(null);
        }
        setDeleteProjectDialog(null);
        setDeletePrecheck(null);
        await refreshProjects();
        setStatus("Projet supprimé");
      } catch (e) {
        setError(String(e));
      } finally {
        setDeleteProjectBusy(false);
      }
    },
    [deleteProjectDialog, selectedId, refreshProjects, clearSessionSnapsForProject],
  );

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await api.fetchDaemonStatus();
      if (!cancelled) setDaemonStatus(next);
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId && projects.some((p) => p.id === selectedId)) {
      return;
    }
    const lastId = getLastProjectId();
    const restoredId = lastId && projects.some((p) => p.id === lastId) ? lastId : projects[0]?.id ?? null;
    setSelectedId(restoredId);
    if (restoredId) setLastProjectId(restoredId);
  }, [projects, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      // Only clear the stored ID once projects have actually been loaded; on the
      // very first render projects is still [] and selectedId is null, so we must
      // not wipe the last-project-id before the restore logic has had a chance to
      // read it.
      if (projects.length > 0) clearLastProjectId();
      return;
    }
    setLastProjectId(selectedId);
  }, [selectedId, projects.length]);

  useEffect(() => {
    if (!selectedId) {
      setChat([]);
      setAcceptanceCriteriaDraft("");
      return;
    }
    skipChatSaveOnce.current = true;
    setChat(loadChatMessages(selectedId));
    setAcceptanceCriteriaDraft("");
  }, [selectedId]);

  useEffect(() => {
    const el = chatLogRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      chatPinnedByUserRef.current = false;
      setChatHasUnseen(false);
    });
  }, [selectedId]);

  useEffect(() => {
    const el = chatLogRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 56;
    if (nearBottom || !chatPinnedByUserRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
      setChatHasUnseen(false);
      return;
    }
    setChatHasUnseen(true);
  }, [chat, taskTrace?.line]);

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
    setDesignDocText("");
    setDesignDocSnapshot("");
    setDesignMarkdownPreview(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setStackPresetId(STACK_PRESET_NONE);
      setStackCustomText("");
      setStackAddons(emptyStackAddons());
      setGitHeadBranch(null);
      setGitWorktreeClean(null);
      setGitWorktreeLines([]);
      setEvolutionSummaryDraft("");
      setProjectSummaryDraft("");
      setPolicyNotesDraft("");
      return;
    }
    let cancelled = false;
    void api
      .getProjectMeta(selectedId)
      .then((m) => {
        if (cancelled) return;
        setGitHeadBranch(m.git_branch ?? null);
        setGitWorktreeClean(m.git_worktree_clean ?? null);
        setGitWorktreeLines(m.git_worktree_lines ?? []);
        setProjectSummaryDraft((m.project_summary ?? "").trim());
        setEvolutionSummaryDraft((m.evolution_summary ?? "").trim());
        setPolicyNotesDraft((m.policy_notes ?? "").trim());
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
          setGitWorktreeLines([]);
          setProjectSummaryDraft("");
          setEvolutionSummaryDraft("");
          setPolicyNotesDraft("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDashboardLastSyncAt(null);
      setCodeRagStatus(null);
      setCodeRagStatusError(null);
      setCodeRagStatusLoading(false);
      return;
    }
    let cancelled = false;
    setCodeRagStatusLoading(true);
    setCodeRagStatusError(null);
    void api
      .getCodeRagStatus(selectedId)
      .then((s) => {
        if (!cancelled) {
          setCodeRagStatus(s);
          setCodeRagStatusError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setCodeRagStatus(null);
          setCodeRagStatusError(String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setCodeRagStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || centerTab !== "dashboard") return;
    let cancelled = false;

    const refreshDashboardData = async () => {
      try {
        const [meta, rag] = await Promise.all([
          api.getProjectMeta(selectedId),
          api.getCodeRagStatus(selectedId),
        ]);
        if (cancelled) return;

        setGitHeadBranch(meta.git_branch ?? null);
        setGitWorktreeClean(meta.git_worktree_clean ?? null);
        setGitWorktreeLines(meta.git_worktree_lines ?? []);
        setProjectSummaryDraft((meta.project_summary ?? "").trim());
        setEvolutionSummaryDraft((meta.evolution_summary ?? "").trim());
        setPolicyNotesDraft((meta.policy_notes ?? "").trim());

        const raw = (meta.tech_stack ?? "").trim();
        if (raw) {
          setStackPresetId(STACK_PRESET_CUSTOM);
          setStackCustomText(meta.tech_stack ?? "");
          setStackAddons(emptyStackAddons());
        } else {
          setStackPresetId(STACK_PRESET_NONE);
          setStackCustomText("");
          setStackAddons(emptyStackAddons());
        }

        setCodeRagStatus(rag);
        setCodeRagStatusError(null);
        setDashboardLastSyncAt(Date.now());

        setProjects((prev) =>
          prev.map((p) =>
            p.id === meta.id
              ? { ...p, name: meta.name || p.name }
              : p,
          ),
        );
      } catch {
        // Silent retry on next poll to avoid noisy UI while dashboard is open.
      }
    };

    void refreshDashboardData();
    const id = window.setInterval(() => {
      void refreshDashboardData();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedId, centerTab]);

  const onReindexCodeRag = useCallback(async () => {
    if (!selectedId) return;
    setCodeRagReindexBusy(true);
    setCodeRagStatusError(null);
    setError(null);
    try {
      const s = await api.reindexCodeRag(selectedId);
      setCodeRagStatus(s);
      setStatus(
        `Index code mis à jour : ${s.files_indexed} fichier(s), ${s.chunks_indexed} bloc(s)${s.built_at ? ` (${s.built_at})` : ""}.`,
      );
    } catch (e) {
      setCodeRagStatusError(String(e));
    } finally {
      setCodeRagReindexBusy(false);
    }
  }, [selectedId]);

  const syncCodeRagAfterFileChange = useCallback((projectId: string) => {
    void api
      .reindexCodeRag(projectId, false)
      .then((s) => {
        if (selectedIdRef.current !== projectId) return;
        setCodeRagStatus(s);
        setCodeRagStatusError(null);
      })
      .catch((e) => {
        if (selectedIdRef.current === projectId) setCodeRagStatusError(String(e));
      });
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    persistCodeMode(codeMode);
  }, [codeMode]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const p = await api.listPendingHumanInput();
        if (!cancelled) setPendingInbox(p);
      } catch {
        if (!cancelled) setPendingInbox([]);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 12000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!selectedId || centerTab !== "plan") return;
    let cancelled = false;
    setPlanDocLoading(true);
    void api
      .readRawFile(selectedId, "CODE_STUDIO_PLAN.md")
      .then((raw) => {
        if (cancelled) return;
        const t = raw.content ?? "";
        setPlanDocText(t);
        try {
          const snap = sessionStorage.getItem(`akasha-plan-snap-${selectedId}`);
          if (snap !== null) {
            setPlanDocSnapshot(snap);
          } else {
            setPlanDocSnapshot(t);
            sessionStorage.setItem(`akasha-plan-snap-${selectedId}`, t);
          }
        } catch {
          setPlanDocSnapshot(t);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlanDocText("");
          setPlanDocSnapshot("");
        }
      })
      .finally(() => {
        if (!cancelled) setPlanDocLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, centerTab]);

  useEffect(() => {
    const shouldLoadDesignDoc = centerTab === "design" || autoApplyDesign;
    if (!selectedId || !shouldLoadDesignDoc) return;
    let cancelled = false;
    setDesignDocLoading(true);
    void api
      .readRawFile(selectedId, "DESIGN.md")
      .then((raw) => {
        if (cancelled) return;
        const t = raw.content ?? "";
        setDesignDocText(t);
        try {
          const snap = sessionStorage.getItem(`akasha-design-snap-${selectedId}`);
          if (snap !== null) {
            setDesignDocSnapshot(snap);
          } else {
            setDesignDocSnapshot(t);
            sessionStorage.setItem(`akasha-design-snap-${selectedId}`, t);
          }
        } catch {
          setDesignDocSnapshot(t);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDesignDocText("");
          setDesignDocSnapshot("");
        }
      })
      .finally(() => {
        if (!cancelled) setDesignDocLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, centerTab, autoApplyDesign]);

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
    // Reset Git state immediately so the Branches tab never shows stale data from the previous project
    setGitBranches([]);
    setGitCompareBase("");
    setGitCompareTarget("");
    setGitCompareResult(null);
    setGitConflicts([]);
    setGitMergeInProgress(false);
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

  const refreshGitBranches = useCallback(async () => {
    if (!selectedId) {
      setGitBranches([]);
      return;
    }
    setGitBranchesLoading(true);
    try {
      const payload = await api.listGitBranches(selectedId);
      setGitBranches(payload.branches);
      if (!gitCompareBase && payload.current_branch) {
        setGitCompareBase(payload.current_branch);
      }
      if (!gitCompareTarget) {
        const fallbackTarget = payload.branches.find((b) => !b.current)?.name ?? "";
        if (fallbackTarget) setGitCompareTarget(fallbackTarget);
      }
    } catch {
      setGitBranches([]);
    } finally {
      setGitBranchesLoading(false);
    }
  }, [selectedId, gitCompareBase, gitCompareTarget]);

  const refreshGitConflicts = useCallback(async () => {
    if (!selectedId) {
      setGitConflicts([]);
      setGitMergeInProgress(false);
      return;
    }
    try {
      const payload = await api.getGitConflicts(selectedId);
      setGitConflicts(payload.conflict_files);
      setGitMergeInProgress(payload.merge_in_progress);
    } catch {
      setGitConflicts([]);
      setGitMergeInProgress(false);
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
        setGitWorktreeLines(m.git_worktree_lines ?? []);
      } catch {
        /* ignore */
      }
      if (centerTab === "branches") {
        await refreshGitBranches();
        await refreshGitConflicts();
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
  }, [selectedId, filePath, editorBinary, editorDirty, reloadOpenFileFromServer, refreshGitBranches, refreshGitConflicts, centerTab]);

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
      const r = await api.installStudioDeps(selectedId, { force: forceInstallBeforePreview });
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
  }, [selectedId, forceInstallBeforePreview]);

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

  const handleStudioRename = useCallback(
    async (from: string, to: string) => {
      if (!selectedId) return;
      const opened = filePath;
      if (
        editorDirty &&
        opened &&
        (opened === from || opened.startsWith(`${from}/`))
      ) {
        if (
          !window.confirm(
            "Le fichier ouvert ou son dossier a des changements non enregistrés. Poursuivre le déplacement ou le renommage ?",
          )
        ) {
          return;
        }
      }
      setError(null);
      try {
        await api.renameStudioPath(selectedId, from, to);
        let nextOpen = opened;
        if (opened === from) nextOpen = to;
        else if (opened?.startsWith(`${from}/`)) nextOpen = to + opened.slice(from.length);
        if (nextOpen !== opened) setFilePath(nextOpen);
        const fl = await api.listFiles(selectedId);
        setFiles(fl);
        syncCodeRagAfterFileChange(selectedId);
        if (nextOpen && fl.includes(nextOpen) && !editorBinary && !editorDirty) {
          try {
            const raw = await api.readRawFile(selectedId, nextOpen);
            const text = raw.content ?? "";
            setEditorText(text);
            setSavedEditorText(text);
            const ext = nextOpen.toLowerCase();
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
        setStatus(`Renommé ou déplacé : ${from} → ${to}`);
      } catch (e) {
        setError(String(e));
      }
    },
    [selectedId, filePath, editorDirty, editorBinary, syncCodeRagAfterFileChange],
  );

  const onDeleteFile = useCallback(
    async (path: string) => {
      if (!selectedId) return;
      if (
        !window.confirm(
          `Supprimer définitivement « ${path} » sur le disque du projet ? Cette action est irréversible.`,
        )
      ) {
        return;
      }
      setError(null);
      try {
        await api.deleteRawFile(selectedId, path);
        if (filePath === path) {
          setFilePath(null);
          setEditorText("");
          setSavedEditorText("");
          setEditorBinary(false);
          setStaticPreviewBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
        const fl = await api.listFiles(selectedId);
        setFiles(fl);
        syncCodeRagAfterFileChange(selectedId);
        setStatus(`Fichier supprimé : ${path}`);
      } catch (e) {
        setError(String(e));
      }
    },
    [selectedId, filePath, syncCodeRagAfterFileChange],
  );

  const saveEditor = useCallback(async () => {
    if (!selectedId || !filePath || editorBinary || !editorDirty) return;
    setError(null);
    try {
      await api.writeRawFile(selectedId, filePath, editorText);
      setSavedEditorText(editorText);
      syncCodeRagAfterFileChange(selectedId);
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
  }, [selectedId, filePath, editorBinary, editorDirty, editorText, syncCodeRagAfterFileChange]);

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
    if (!openHeaderMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenHeaderMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openHeaderMenu]);

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
      const summary = newProjectSummary.trim();
      const p = await api.createProject({
        name,
        ...(stack ? { tech_stack: stack } : {}),
        ...(summary ? { project_summary: summary } : {}),
      });
      await refreshProjects();
      setSelectedId(p.id);
      setCenterTab("dashboard");
      setNewProjectSummary("");
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

  const onSaveEvolutionAndPolicy = async () => {
    if (!selectedId) return;
    setError(null);
    try {
      await api.patchProjectSettings(selectedId, {
        project_summary: projectSummaryDraft.trim() ? projectSummaryDraft.trim() : null,
        evolution_summary: evolutionSummaryDraft.trim() ? evolutionSummaryDraft.trim() : null,
        policy_notes: policyNotesDraft.trim() ? policyNotesDraft.trim() : null,
      });
      setStatus("Résumés produit / évolution et politique enregistrés (réinjectés dans les prochains messages)");
    } catch (e) {
      setError(String(e));
    }
  };

  const onSavePlanFromTab = async () => {
    if (!selectedId) return;
    setError(null);
    try {
      await api.writeRawFile(selectedId, "CODE_STUDIO_PLAN.md", planDocText);
      setPlanDocSnapshot(planDocText);
      syncCodeRagAfterFileChange(selectedId);
      try {
        sessionStorage.setItem(`akasha-plan-snap-${selectedId}`, planDocText);
      } catch { /* quota / private mode — snapshot skipped */ }
      setStatus("CODE_STUDIO_PLAN.md enregistré sur le disque projet");
    } catch (e) {
      setError(String(e));
    }
  };

  const downloadTextFile = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const onSaveDesignFromTab = async () => {
    if (!selectedId) return;
    setError(null);
    try {
      await api.writeRawFile(selectedId, "DESIGN.md", designDocText);
      setDesignDocSnapshot(designDocText);
      syncCodeRagAfterFileChange(selectedId);
      try {
        sessionStorage.setItem(`akasha-design-snap-${selectedId}`, designDocText);
      } catch { /* quota / private mode — snapshot skipped */ }
      setStatus("DESIGN.md enregistré sur le disque projet");
    } catch (e) {
      setError(String(e));
    }
  };

  const onImportDesignFromDisk = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.txt,text/markdown,text/plain";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const normalized = normalizeDesignDoc(text);
      setDesignDocText(normalized);
      const parsed = parseDesignDoc(normalized);
      setStatus(
        `Design importé depuis ${file.name} — statut: ${parsed.status}, diagnostics: ${parsed.diagnostics.length}`,
      );
    };
    input.click();
  }, []);

  const onExportDesignDoc = useCallback(() => {
    downloadTextFile("DESIGN.md", designDocText);
    setStatus("Export DESIGN.md déclenché");
  }, [designDocText, downloadTextFile]);

  const onExportDesignTokens = useCallback(() => {
    downloadTextFile("DESIGN.tokens.json", designTokensToJson(parsedDesignDoc));
    setStatus("Export DESIGN.tokens.json déclenché");
  }, [downloadTextFile, parsedDesignDoc]);

  const onExportDesignCss = useCallback(() => {
    downloadTextFile("DESIGN.css", designTokensToCss(parsedDesignDoc));
    setStatus("Export DESIGN.css déclenché");
  }, [downloadTextFile, parsedDesignDoc]);

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

  const onCheckoutBranch = useCallback(async (branch: string) => {
    if (!selectedId) return;
    setError(null);
    try {
      await api.checkoutGitBranch(selectedId, branch);
      setStatus(`Branche active: ${branch}`);
      await refreshFiles();
    } catch (e) {
      setError(String(e));
    }
  }, [selectedId, refreshFiles]);

  const onCompareBranches = useCallback(async () => {
    if (!selectedId || !gitCompareBase || !gitCompareTarget) return;
    setError(null);
    try {
      const compare = await api.compareGitBranches(selectedId, gitCompareBase, gitCompareTarget);
      setGitCompareResult(compare);
    } catch (e) {
      setError(String(e));
      setGitCompareResult(null);
    }
  }, [selectedId, gitCompareBase, gitCompareTarget]);

  const onMergeBranches = useCallback(async () => {
    if (!selectedId || !gitCompareBase || !gitCompareTarget) return;
    setError(null);
    try {
      const result = await api.mergeGitBranches(selectedId, gitCompareTarget, gitCompareBase);
      setStatus(result.message || "Merge effectué");
      await refreshFiles();
      await refreshGitConflicts();
    } catch (e) {
      setError(String(e));
      await refreshGitConflicts();
    }
  }, [selectedId, gitCompareBase, gitCompareTarget, refreshFiles, refreshGitConflicts]);

  const onAbortMerge = useCallback(async () => {
    if (!selectedId) return;
    setError(null);
    try {
      await api.abortGitMerge(selectedId);
      setStatus("Merge annulé");
      await refreshGitConflicts();
      await refreshFiles();
    } catch (e) {
      setError(String(e));
    }
  }, [selectedId, refreshGitConflicts, refreshFiles]);

  const onNewEvolution = async () => {
    if (!selectedId) {
      setError("Sélectionnez d’abord un projet avant de créer une branche d’évolution.");
      return;
    }
    setError(null);
    setStatus("Création de la branche d’évolution…");
    try {
      const r = await api.createEvolution(selectedId, evoLabel || undefined);
      setSelectedEvoId(r.evolution_id);
      const evo = await api.listEvolutions(selectedId);
      setEvolutions(evo);
      setEvoLabel("");
      setStatus(`Branche créée : ${r.branch}`);
    } catch (e) {
      setError(String(e));
      setStatus("");
    }
  };

  const activeBranch = useMemo(() => {
    if (!selectedEvoId) return null;
    return evolutions.find((e) => e.id === selectedEvoId)?.branch ?? null;
  }, [evolutions, selectedEvoId]);

  const pollTask = useCallback(
    async (taskId: string, signal: AbortSignal, studioProjectId: string | null) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      try {
        while (!signal.aborted) {
          const t = await api.getTask(taskId);
          if (signal.aborted) return;

          let hi: api.TaskHumanInputPayload | null = null;
          try {
            hi = await api.getTaskHumanInput(taskId);
          } catch {
            hi = null;
          }
          if (signal.aborted) return;
          if (hi?.question) {
            setPendingHumanInput({
              taskId,
              question: hi.question,
              context: (hi.context ?? "").trim(),
              choices: hi.choices?.length ? hi.choices : null,
            });
            setTaskTrace({
              id: taskId,
              status: t.status,
              line: "L’agent attend votre réponse (champs ci-dessous).",
              done: true,
              progressChips: undefined,
            });
            return;
          }

          const traceProgress = dedupeProgressForTrace(t.progress ?? [], taskId);
          const last = traceProgress.length ? traceProgress[traceProgress.length - 1] : undefined;
          const lastMsg = last?.message?.trim() ?? "";
          const fd = (t.failure_detail ?? "").trim();
          const useFailureDetail =
            (t.status === "failed" || t.status === "cancelled") &&
            fd.length > 0 &&
            (!lastMsg || isStubProgressMessage(lastMsg));
          const line = useFailureDetail
            ? `${last?.progress_pct ?? 100}% — ${fd.length > 900 ? `${fd.slice(0, 900)}…` : fd}`
            : last
              ? `${last.progress_pct}% — ${last.message}`
              : formatTaskStatusFr(t.status);
          const progressChips = traceProgress
            .filter((p) => p.message && !isStubProgressMessage(p.message))
            .slice(-12)
            .map((p) => {
              const msg = p.message.trim();
              const short = msg.length > 96 ? `${msg.slice(0, 96)}…` : msg;
              return `${p.progress_pct}% ${short}`;
            });
          setTaskTrace({
            id: taskId,
            status: t.status,
            line,
            done: api.isTaskTerminal(t.status) || api.isTaskNeedsUser(t.status),
            progressChips: progressChips.length ? progressChips : undefined,
          });
          if (api.isTaskTerminal(t.status) || api.isTaskNeedsUser(t.status)) {
            if (studioProjectId && api.isTaskTerminal(t.status)) {
              clearActiveTask(studioProjectId);
            }
            if (api.isTaskTerminal(t.status) && t.status === "completed" && selectedId) {
              try {
                const fl = await api.listFiles(selectedId);
                setFiles(fl);
                syncCodeRagAfterFileChange(selectedId);
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
            const summary = chatMessageForTerminalTask(t.status, last?.message, t.failure_detail);
            setChat((c) => [
              ...c,
              {
                role: "assistant",
                text: summary,
                task_id: taskId,
                suggested_actions: t.suggested_actions,
              },
            ]);
            void (async () => {
              try {
                const sd = await api.getTaskStudioDiff(taskId);
                if (!sd?.files?.length) return;
                setChat((c) => {
                  const next = [...c];
                  for (let i = next.length - 1; i >= 0; i--) {
                    const row = next[i];
                    if (row.role === "assistant" && row.task_id === taskId) {
                      next[i] = { ...row, studio_diff: sd };
                      break;
                    }
                  }
                  return next;
                });
              } catch {
                /* snapshot absent ou erreur réseau */
              }
            })();
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
    [selectedId, syncCodeRagAfterFileChange],
  );

  /** Au chargement / changement de projet : reprendre le polling si une tâche non terminale était en cours. */
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const stored = loadActiveTask(selectedId);
    if (!stored?.taskId) return;
    void (async () => {
      try {
        const t = await api.getTask(stored.taskId);
        if (cancelled) return;
        if (api.isTaskTerminal(t.status)) {
          clearActiveTask(selectedId);
          return;
        }
        pollTaskAbortRef.current?.abort();
        const ac = new AbortController();
        pollTaskAbortRef.current = ac;
        setTaskTrace({
          id: stored.taskId,
          status: t.status,
          line: "Tâche en cours (reprise après rechargement)…",
          done: false,
        });
        void pollTask(stored.taskId, ac.signal, selectedId);
      } catch {
        if (!cancelled) clearActiveTask(selectedId);
      }
    })();
    return () => {
      cancelled = true;
      pollTaskAbortRef.current?.abort();
    };
  }, [selectedId, pollTask]);

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
      if (!cancelled) {
        setTimeout(() => void tick(), 1500);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [selectedId, centerTab]);

  useEffect(() => {
    if (!selectedId || centerTab !== "branches") return;
    void refreshGitBranches();
    void refreshGitConflicts();
  }, [selectedId, centerTab, refreshGitBranches, refreshGitConflicts]);

  useEffect(() => {
    if (centerTab !== "docs") {
      // Clear any prior fetch error so navigating back will retry.
      setUserGuideError(null);
      return;
    }
    if (userGuideDoc.trim()) return;
    if (userGuideError) return;  // fetch already failed this tab visit; guard cleared on tab exit
    let cancelled = false;
    setUserGuideLoading(true);
    setUserGuideError(null);
    void fetch("/docs/USER_GUIDE.md")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Unable to load documentation (${res.status})`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setUserGuideDoc(text);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setUserGuideError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setUserGuideLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [centerTab, userGuideDoc, userGuideError]);

  const onRegeneratePlan = useCallback(async () => {
    if (!selectedId) return;
    const msg = `[Tâche Code Studio — plan projet (réinitialisation / complétion)]
Le plan doit suivre le **gabarit fixe** à sections : **Titre** (ligne \`# Titre : …\`), **Description**, **Scope**, **Stack**, **Structure du projet**, **Commandes**, **Fichiers hors scope**, **Demandes d'évolutions utilisateur par phase**, **Recommandations**, **Todos**, **Informations complémentaires** (conserver ces titres \`## …\` et cet ordre).
1) \`read_file workspace:/CODE_STUDIO_PLAN.md\` si le fichier existe.
2) Si le fichier existe : **fusionner** — compléter ou corriger section par section à partir du dépôt ; **ne pas** réécrire tout le document si le contenu est déjà structuré : préserver les sections encore pertinentes et l’historique utile (lignes datées dans *Informations complémentaires* ou *Demandes d'évolutions…*).
3) Si le fichier est absent : le créer avec le gabarit complet (placeholders acceptés) en synthétisant fichiers, stack et scripts réels.
4) Ne pas inventer de fonctionnalités absentes du code. Réécriture intégrale **uniquement** si le fichier est vide ou totalement hors gabarit sans sections exploitables.`;
    setError(null);
    pollTaskAbortRef.current?.abort();
    setPendingHumanInput(null);
    setHumanReplyDraft("");
    setTaskTrace(null);
    try {
      const acc = api.parseStudioAcceptanceCriteriaInput(acceptanceCriteriaDraft);
      const { task_id } = await api.sendMessage({
        message: msg,
        studio_project_id: selectedId,
        studio_assigned_agent: agent || undefined,
        studio_evolution_id: selectedEvoId ?? undefined,
        studio_evolution_branch: activeBranch ?? undefined,
        studio_code_mode: codeMode,
        studio_policy_hint: policyHintOneShot.trim() || undefined,
        studio_delegate_single_level: delegateSingleLevel || undefined,
        studio_design_hint: autoApplyDesign ? designHint || undefined : undefined,
        studio_design_doc: autoApplyDesign ? designDocText.trim() || undefined : undefined,
        ...(acc !== undefined ? { studio_acceptance_criteria: acc } : {}),
      });
      setChat((c) => [...c, { role: "user", text: msg, task_id }]);
      setPolicyHintOneShot("");
      const ac = new AbortController();
      pollTaskAbortRef.current = ac;
      setTaskTrace({
        id: task_id,
        status: "queued",
        line: "Régénération du plan…",
        done: false,
        progressChips: undefined,
      });
      saveActiveTask(selectedId, task_id);
      void pollTask(task_id, ac.signal, selectedId);
    } catch (e) {
      setError(String(e));
    }
  }, [
    selectedId,
    agent,
    selectedEvoId,
    activeBranch,
    pollTask,
    codeMode,
    policyHintOneShot,
    delegateSingleLevel,
    autoApplyDesign,
    designHint,
    designDocText,
    acceptanceCriteriaDraft,
  ]);

  const onRegenerateDesign = useCallback(async (forceRecreateFromProjectStyle = false) => {
    if (!selectedId) return;
    const msg = `[Tâche Code Studio — DESIGN.md (${forceRecreateFromProjectStyle ? "recréation depuis style projet" : "réinitialisation / complétion"})]
Produire ou mettre à jour DESIGN.md pour qu'il respecte **exactement** le gabarit Code Studio ci-dessous (pas un article markdown générique ni un document de design “libre”).

Language requirement: the DESIGN.md file MUST be written in English only (headings, rationale, component notes, and usage guidance).

${DESIGN_DOC_AGENT_STRUCTURE_SPEC_EN}

Procédure:
1) Lire \`workspace:/DESIGN.md\` si présent.
2) Si DESIGN.md est absent ou recréation forcée depuis le dépôt: extraire **uniquement** ce qui est observable dans le code — en priorité \`index.css\`, \`*.css\`, \`tailwind.config.*\`, thème/tokens, variables CSS (\`--*\`), composants UI clés. Ne pas inventer de styles absents du code.
3) Si DESIGN.md existe déjà (et pas de recréation forcée): fusionner sans perdre la prose utile ; conserver les tokens YAML valides ; réaligner la structure sur le gabarit si nécessaire.
4) Vérifier cohérence: \`name\`, \`colors\`, \`typography\` (objets imbriqués YAML), \`rounded\`/\`spacing\` si présents dans le code, sections \`##\` canoniques dans l'ordre indiqué dans le bloc anglais.
5) Écrire ou mettre à jour **uniquement** \`workspace:/DESIGN.md\` (pas d'autres fichiers pour cette tâche sauf lecture).`;
    setError(null);
    pollTaskAbortRef.current?.abort();
    setPendingHumanInput(null);
    setHumanReplyDraft("");
    setTaskTrace(null);
    try {
      const oneShotPolicy = [
        policyHintOneShot.trim(),
        forceRecreateFromProjectStyle
          ? "Priorité: recréer DESIGN.md depuis les styles du dépôt actuel (pas de style inventé)."
          : "",
        "Règle obligatoire: DESIGN.md doit rester entièrement en anglais.",
        "Structure obligatoire: suivre le bloc « Mandatory file shape (Code Studio DESIGN.md) » du message utilisateur (YAML + ordre des sections ##, titres acceptés inclus).",
      ]
        .filter(Boolean)
        .join("\n");
      const regenerateDesignHint = [DESIGN_DOC_AGENT_STUDIO_HINT_COMPACT_EN, designHint.trim()]
        .filter(Boolean)
        .join("\n\n");
      const acc = api.parseStudioAcceptanceCriteriaInput(acceptanceCriteriaDraft);
      const { task_id } = await api.sendMessage({
        message: msg,
        studio_project_id: selectedId,
        studio_assigned_agent: agent || undefined,
        studio_evolution_id: selectedEvoId ?? undefined,
        studio_evolution_branch: activeBranch ?? undefined,
        studio_code_mode: codeMode,
        studio_policy_hint: oneShotPolicy || undefined,
        studio_delegate_single_level: delegateSingleLevel || undefined,
        studio_design_hint: regenerateDesignHint || undefined,
        studio_design_doc: designDocText.trim() || undefined,
        ...(acc !== undefined ? { studio_acceptance_criteria: acc } : {}),
      });
      setChat((c) => [...c, { role: "user", text: msg, task_id }]);
      setPolicyHintOneShot("");
      const ac = new AbortController();
      pollTaskAbortRef.current = ac;
      setTaskTrace({
        id: task_id,
        status: "queued",
        line: "Régénération du design…",
        done: false,
        progressChips: undefined,
      });
      saveActiveTask(selectedId, task_id);
      void pollTask(task_id, ac.signal, selectedId);
    } catch (e) {
      setError(String(e));
    }
  }, [
    selectedId,
    agent,
    selectedEvoId,
    activeBranch,
    pollTask,
    codeMode,
    policyHintOneShot,
    delegateSingleLevel,
    designDocText,
    autoApplyDesign,
    designHint,
    acceptanceCriteriaDraft,
  ]);

  const onSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !selectedId) return;
    setChatInput("");
    setError(null);
    pollTaskAbortRef.current?.abort();
    setPendingHumanInput(null);
    setHumanReplyDraft("");
    setTaskTrace(null);
    try {
      const acc = api.parseStudioAcceptanceCriteriaInput(acceptanceCriteriaDraft);
      const { task_id } = await api.sendMessage({
        message: text,
        studio_project_id: selectedId,
        studio_assigned_agent: agent || undefined,
        studio_evolution_id: selectedEvoId ?? undefined,
        studio_evolution_branch: activeBranch ?? undefined,
        studio_code_mode: codeMode,
        studio_policy_hint: policyHintOneShot.trim() || undefined,
        studio_delegate_single_level: delegateSingleLevel || undefined,
        studio_design_hint: autoApplyDesign ? designHint || undefined : undefined,
        studio_design_doc: autoApplyDesign ? designDocText.trim() || undefined : undefined,
        ...(acc !== undefined ? { studio_acceptance_criteria: acc } : {}),
      });
      setChat((c) => [...c, { role: "user", text, task_id }]);
      setPolicyHintOneShot("");
      const ac = new AbortController();
      pollTaskAbortRef.current = ac;
      setTaskTrace({
        id: task_id,
        status: "queued",
        line: "Requête acceptée par le daemon — démarrage…",
        done: false,
        progressChips: undefined,
      });
      saveActiveTask(selectedId, task_id);
      void pollTask(task_id, ac.signal, selectedId);
    } catch (e) {
      setError(String(e));
    }
  };

  const onOpenForkDialog = useCallback((index: number, msg: ChatMessage) => {
    if (!msg.task_id) return;
    setForkDialog({
      open: true,
      index,
      parentTaskId: msg.task_id,
      sourceText: msg.text,
    });
    setForkInitialInstruction(msg.text);
  }, []);

  const onCreateFork = useCallback(async () => {
    if (!selectedId || !forkDialog) return;
    const text = forkInitialInstruction.trim();
    if (!text) return;
    setError(null);
    pollTaskAbortRef.current?.abort();
    setPendingHumanInput(null);
    setHumanReplyDraft("");
    setTaskTrace(null);
    try {
      const acc = api.parseStudioAcceptanceCriteriaInput(acceptanceCriteriaDraft);
      const { task_id } = await api.sendMessage({
        message: text,
        studio_project_id: selectedId,
        studio_assigned_agent: agent || undefined,
        studio_evolution_id: selectedEvoId ?? undefined,
        studio_evolution_branch: activeBranch ?? undefined,
        studio_code_mode: codeMode,
        studio_policy_hint: policyHintOneShot.trim() || undefined,
        studio_delegate_single_level: delegateSingleLevel || undefined,
        studio_design_hint: autoApplyDesign ? designHint || undefined : undefined,
        studio_design_doc: autoApplyDesign ? designDocText.trim() || undefined : undefined,
        fork_from_task_id: forkDialog.parentTaskId,
        fork_after_message_index: forkDialog.index,
        ...(acc !== undefined ? { studio_acceptance_criteria: acc } : {}),
      });
      setChat((c) => [
        ...c,
        {
          role: "user",
          text: `[Fork depuis #${forkDialog.index + 1}] ${text}`,
          task_id,
        },
      ]);
      setForkDialog(null);
      setForkInitialInstruction("");
      const ac = new AbortController();
      pollTaskAbortRef.current = ac;
      setTaskTrace({
        id: task_id,
        status: "queued",
        line: `Nouvelle branche créée depuis #${forkDialog.index + 1} — démarrage…`,
        done: false,
        progressChips: undefined,
      });
      saveActiveTask(selectedId, task_id);
      void pollTask(task_id, ac.signal, selectedId);
    } catch (e) {
      setError(String(e));
    }
  }, [
    selectedId,
    forkDialog,
    forkInitialInstruction,
    agent,
    selectedEvoId,
    activeBranch,
    pollTask,
    codeMode,
    policyHintOneShot,
    delegateSingleLevel,
    autoApplyDesign,
    designHint,
    designDocText,
    acceptanceCriteriaDraft,
  ]);

  const onSubmitHumanReply = useCallback(async () => {
    if (!pendingHumanInput) return;
    let text = humanReplyDraft.trim();
    if (!text) return;
    const refusal = looksLikeStructuredRefusal(text);
    let nextStreak = refusal ? humanRefusalStreak + 1 : 0;
    if (refusal && nextStreak >= 3) {
      text = `${text}\n\n[Note interface Code Studio] Refus répétés : merci de poser une question précise à l'utilisateur ou de proposer une marche alternative (ne pas réessayer la même action sans nouveau contexte).`;
      nextStreak = 0;
    }
    setHumanRefusalStreak(nextStreak);
    setHumanReplyBusy(true);
    setError(null);
    try {
      await api.postTaskHumanReply(pendingHumanInput.taskId, text);
      const tid = pendingHumanInput.taskId;
      setPendingHumanInput(null);
      setHumanReplyDraft("");
      const ac = new AbortController();
      pollTaskAbortRef.current = ac;
      setTaskTrace({
        id: tid,
        status: "running",
        line: "Réponse enregistrée — reprise de la tâche…",
        done: false,
      });
      void pollTask(tid, ac.signal, selectedId);
    } catch (e) {
      setError(String(e));
    } finally {
      setHumanReplyBusy(false);
    }
  }, [pendingHumanInput, humanReplyDraft, pollTask, selectedId, humanRefusalStreak]);

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

  const humanInputRiskLevel = useMemo((): ActionRiskLevel | null => {
    if (!pendingHumanInput) return null;
    return inferActionRisk(`${pendingHumanInput.question}\n${pendingHumanInput.context}`);
  }, [pendingHumanInput]);

  useEffect(() => {
    setHumanRefusalStreak(0);
  }, [pendingHumanInput?.taskId]);

  const previewUrl = devPreviewUrl ?? staticPreviewBlobUrl;

  const openPreviewInNewWindow = useCallback(() => {
    if (!previewUrl) return;
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }, [previewUrl]);

  const applyUiSuggestedAction = useCallback(
    (action: string | undefined) => {
      if (!action) return;
      switch (action) {
        case "open_editor":
          setCenterTab("editor");
          setMainSplit("balanced");
          break;
        case "open_preview":
          setCenterTab("preview");
          setMainSplit("balanced");
          break;
        case "open_design":
          setCenterTab("design");
          setMainSplit("balanced");
          break;
        case "refresh_files":
          void refreshFiles();
          break;
        default:
          break;
      }
    },
    [refreshFiles],
  );

  /** Merges two event arrays: deduplicates by id when available; otherwise keeps all events using positional keys. */
  const mergeTaskEvents = useCallback(
    (base: api.TaskEventEntry[], incoming: api.TaskEventEntry[]): api.TaskEventEntry[] => {
      const byKey = new Map<string, api.TaskEventEntry>();
      // Base (polling snapshot): preserve all events. Use id as key when available so SSE can dedup against it.
      for (let i = 0; i < base.length; i++) {
        const ev = base[i];
        const k = ev.id
          ? `id:${ev.id}::${ev.task_id ?? ""}`
          : `base:${i}::${ev.event_type}::${ev.at}::${ev.task_id ?? ""}`;
        byKey.set(k, ev);
      }
      // Incoming (SSE snapshot): dedup by id against base; otherwise keep all positionally.
      for (let i = 0; i < incoming.length; i++) {
        const ev = incoming[i];
        const k = ev.id
          ? `id:${ev.id}::${ev.task_id ?? ""}`
          : `sse:${i}::${ev.event_type}::${ev.at}::${ev.task_id ?? ""}`;
        byKey.set(k, ev);
      }
      return Array.from(byKey.values()).sort((a, b) => a.at.localeCompare(b.at));
    },
    [],
  );

  const onOpenTaskDetailModal = useCallback(async (taskId: string) => {
    setTaskDetailForId(taskId);
    setTaskDetailLoading(true);
    setTaskDetailError(null);
    setTaskDetailPayload(null);
    setTaskDetailLiveMode(null);
    taskDetailLiveSnapshotRef.current = null;
    try {
      const [task, events] = await Promise.all([api.getTask(taskId), api.getTaskEvents(taskId)]);
      // Merge with any live events that arrived while the initial fetch was in flight.
      const liveSnapshot: api.TaskEventEntry[] | null = taskDetailLiveSnapshotRef.current;
      taskDetailLiveSnapshotRef.current = null;
      const merged = liveSnapshot ? mergeTaskEvents(events, liveSnapshot) : events;
      setTaskDetailPayload({ task, events: merged });
    } catch (e) {
      setTaskDetailError(String(e));
    } finally {
      setTaskDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!taskDetailForId) {
      setTaskDetailLiveMode(null);
      return;
    }
    let closed = false;
    // Track the current delivery mode: polling delivers full ordered snapshots (replace), while
    // SSE provides deduplicated incremental events (merge). Keeping them separate avoids
    // accumulating id-less duplicate rows each time a polling tick delivers a new full snapshot.
    let currentMode: "sse" | "polling" = "polling";
    const sub = api.subscribeTaskEventsLive(
      taskDetailForId,
      (liveEvents) => {
        if (closed) return;
        setTaskDetailPayload((prev) => {
          if (!prev) {
            // Initial fetch not yet complete — buffer so it can be merged on arrival.
            taskDetailLiveSnapshotRef.current = liveEvents;
            return prev;
          }
          // Polling delivers full snapshots: replace to avoid accumulating id-less duplicates.
          // SSE accumulates deduplicated incremental events: merge to preserve any that arrived
          // before the modal's initial fetch completed.
          if (currentMode === "polling") {
            return { ...prev, events: liveEvents };
          }
          return { ...prev, events: mergeTaskEvents(prev.events, liveEvents) };
        });
      },
      {
        pollIntervalMs: 1800,
        preferSse: true,
        onModeChange: (m) => {
          currentMode = m;
          setTaskDetailLiveMode(m);
        },
      },
    );
    currentMode = sub.mode;
    setTaskDetailLiveMode(sub.mode);

    const statusTimer = window.setInterval(() => {
      void api
        .getTask(taskDetailForId)
        .then((task) => {
          if (closed) return;
          setTaskDetailPayload((prev) =>
            prev ? { ...prev, task } : { task, events: [] },
          );
        })
        .catch(() => {
          /* keep current detail snapshot */
        });
    }, 1800);

    return () => {
      closed = true;
      sub.close();
      window.clearInterval(statusTimer);
    };
  }, [taskDetailForId]);

  const onFixDesignDiagnostics = useCallback(async () => {
    if (!selectedId) return;
    const problems = parsedDesignDoc.diagnostics
      .filter((d) => d.severity === "error" || d.severity === "warning")
      .map((d) => `- [${d.severity}] ${d.path}: ${d.message}`)
      .join("\n");
    const msg = `[Tâche Code Studio — corriger DESIGN.md (diagnostics)]
Les diagnostics suivants doivent être corrigés **uniquement** en éditant \`workspace:/DESIGN.md\` (respecter le contrat Design Code Studio : YAML + sections ## en anglais) :

${problems}

Ne modifie aucun autre fichier pour cette tâche sauf lecture pour contexte.`;
    setError(null);
    pollTaskAbortRef.current?.abort();
    setPendingHumanInput(null);
    setHumanReplyDraft("");
    setTaskTrace(null);
    try {
      const acc = api.parseStudioAcceptanceCriteriaInput(acceptanceCriteriaDraft);
      const { task_id } = await api.sendMessage({
        message: msg,
        studio_project_id: selectedId,
        studio_assigned_agent: agent || undefined,
        studio_evolution_id: selectedEvoId ?? undefined,
        studio_evolution_branch: activeBranch ?? undefined,
        studio_code_mode: codeMode,
        studio_policy_hint: policyHintOneShot.trim() || undefined,
        studio_delegate_single_level: delegateSingleLevel || undefined,
        studio_design_hint: autoApplyDesign ? designHint || undefined : undefined,
        studio_design_doc: autoApplyDesign ? designDocText.trim() || undefined : undefined,
        ...(acc !== undefined ? { studio_acceptance_criteria: acc } : {}),
      });
      setChat((c) => [...c, { role: "user", text: msg, task_id }]);
      setPolicyHintOneShot("");
      const ac = new AbortController();
      pollTaskAbortRef.current = ac;
      setTaskTrace({
        id: task_id,
        status: "queued",
        line: "Correction DESIGN.md (diagnostics)…",
        done: false,
        progressChips: undefined,
      });
      saveActiveTask(selectedId, task_id);
      void pollTask(task_id, ac.signal, selectedId);
    } catch (e) {
      setError(String(e));
    }
  }, [
    selectedId,
    agent,
    selectedEvoId,
    activeBranch,
    pollTask,
    codeMode,
    policyHintOneShot,
    delegateSingleLevel,
    autoApplyDesign,
    designHint,
    designDocText,
    parsedDesignDoc.diagnostics,
    acceptanceCriteriaDraft,
  ]);

  const codeRagBadgeTitle = useMemo(() => {
    if (codeRagStatusLoading) return "Chargement de l’état d’index…";
    if (codeRagStatusError) return codeRagStatusError;
    if (!codeRagStatus) return "";
    const { files_indexed, chunks_indexed, built_at, status } = codeRagStatus;
    return `État : ${status}. Fichiers indexés : ${files_indexed}, blocs : ${chunks_indexed}.${built_at ? ` Dernière construction : ${built_at}.` : ""}`;
  }, [codeRagStatus, codeRagStatusError, codeRagStatusLoading]);

  const codeRagBadgeVariant = useMemo(() => {
    if (!codeRagStatus) return "ready" as const;
    if (codeRagStatus.status === "absent") return "absent" as const;
    if (codeRagStatus.stale || codeRagStatus.status === "stale") return "stale" as const;
    return "ready" as const;
  }, [codeRagStatus]);

  const appMainClass =
    "app-main app-main--" +
    (mainSplit === "balanced" ? "balanced" : mainSplit === "center" ? "center-max" : "chat-max");
  const appClass = `app ${uiDensity === "compact" ? "app--density-compact" : ""} ${!sidebarOpen ? "app--sidebar-collapsed" : ""}`;

  const lastAssistant = useMemo(() => {
    for (let i = chat.length - 1; i >= 0; i -= 1) {
      if (chat[i]?.role === "assistant") return chat[i];
    }
    return null;
  }, [chat]);

  const designHasFixableDiagnostics = useMemo(
    () =>
      parsedDesignDoc.diagnostics.some((d) => d.severity === "error" || d.severity === "warning"),
    [parsedDesignDoc.diagnostics],
  );

  useEffect(() => {
    if (!taskDetailForId) return;
    setTaskDetailTab("events");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTaskDetailForId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [taskDetailForId]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", uiTheme);
    try { window.localStorage.setItem("studio.uiTheme", uiTheme); } catch { /* quota / private mode */ }
  }, [uiTheme]);

  useEffect(() => {
    try { window.localStorage.setItem("studio.uiDensity", uiDensity); } catch { /* quota / private mode */ }
  }, [uiDensity]);

  useEffect(() => {
    try { window.localStorage.setItem("studio.chatOptionsOpen", chatOptionsOpen ? "1" : "0"); } catch { /* quota / private mode */ }
  }, [chatOptionsOpen]);

  useEffect(() => {
    try { window.localStorage.setItem("studio.chatSuggestionsOpen", chatSuggestionsOpen ? "1" : "0"); } catch { /* quota / private mode */ }
  }, [chatSuggestionsOpen]);

  useEffect(() => {
    try { window.localStorage.setItem("studio.buildLogOpen", buildLogOpen ? "1" : "0"); } catch { /* quota / private mode */ }
  }, [buildLogOpen]);

  useEffect(() => {
    try { window.localStorage.setItem(CENTER_TAB_STORAGE_KEY, centerTab); } catch { /* quota / private mode */ }
  }, [centerTab]);

  useEffect(() => {
    try { window.localStorage.setItem("akasha-studio-sidebar-open", sidebarOpen ? "1" : "0"); } catch { /* quota / private mode */ }
  }, [sidebarOpen]);

  const handleSidebarToggle = (open: boolean) => {
    setSidebarOpen(open);
  };

  const handleSidebarTabSelect = (tab: CenterTab) => {
    setCenterTab(tab);
    if (mainSplit === "chat") {
      setMainSplit("balanced");
    }
  };

  useEffect(() => {
    const next = getGroupForTab(centerTab);
    if (next && next !== activeGroup) {
      setActiveGroup(next);
    }
  }, [centerTab, activeGroup]);

  // Get filtered tabs for the active group
  const visibleTabs = useMemo(
    () => {
      const groupTabs = getTabsForGroup(activeGroup);
      return CENTER_TAB_ITEMS.filter((tab) => groupTabs.includes(tab.id));
    },
    [activeGroup]
  );

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
        activeTab={centerTab}
        onTabSelect={handleSidebarTabSelect}
        onGroupSelect={setActiveGroup}
        activeGroup={activeGroup}
      />
      <div className={appClass}>
      <header className="app-header app-header--compact">
        <div className="app-header-row">
          <h1>Code Studio</h1>
          {selectedProject ? (
            <div className="app-header-meta" aria-label="Projet et branches Git">
              <span className="app-header-project">
                <span className="app-header-project-name">{selectedProject.name}</span>
                <code className="app-header-project-id" title={selectedProject.id}>
                  {selectedProject.id.slice(0, 8)}…
                </code>
              </span>
              <span className="app-header-code-rag" aria-label="Index code du projet">
                {codeRagStatusLoading ? (
                  <span className="code-rag-badge code-rag-badge--loading" data-testid="studio-code-rag-badge">
                    Index…
                  </span>
                ) : codeRagStatusError ? (
                  <span
                    className="code-rag-badge code-rag-badge--error"
                    data-testid="studio-code-rag-badge"
                    title={codeRagBadgeTitle}
                  >
                    Index indisponible
                  </span>
                ) : codeRagStatus ? (
                  <span
                    className={`code-rag-badge code-rag-badge--${codeRagBadgeVariant}`}
                    data-testid="studio-code-rag-badge"
                    title={codeRagBadgeTitle}
                  >
                    {codeRagBadgeVariant === "absent"
                      ? "Non indexé"
                      : codeRagBadgeVariant === "stale"
                        ? "Index obsolète"
                        : "Indexé"}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm app-header-reindex-btn"
                  data-testid="studio-code-rag-reindex"
                  disabled={codeRagReindexBusy || codeRagStatusLoading}
                  title="Reconstruire l’index local des sources (recherche et contexte pour l’agent)"
                  onClick={() => void onReindexCodeRag()}
                >
                  {codeRagReindexBusy ? "Réindexation…" : "Réindexer"}
                </button>
              </span>
              <span className="app-header-branches">
                <span className="app-header-branch" title="Branche Git courante (HEAD)">
                  <span className="app-header-branch-label">HEAD</span>
                  <code>{gitHeadBranch ?? "—"}</code>
                  {gitWorktreeClean === false ? (
                    <span className="app-header-dirty" title="Modifications non commitées">
                      ●
                    </span>
                  ) : null}
                  {gitWorktreeClean === true ? (
                    <span className="app-header-clean hint" title="Arbre de travail propre">
                      propre
                    </span>
                  ) : null}
                </span>
                {activeBranch ? (
                  <span className="app-header-branch" title="Branche d’évolution Code Studio sélectionnée">
                    <span className="app-header-branch-label">Évolution</span>
                    <code>{activeBranch}</code>
                  </span>
                ) : null}
                <span className="header-menu-wrap app-header-git-popover">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    data-testid="studio-git-worktree-toggle"
                    disabled={!selectedId}
                    aria-expanded={gitStatusPopoverOpen}
                    title="Fichiers modifiés (git status --porcelain)"
                    onClick={() => setGitStatusPopoverOpen((v) => !v)}
                  >
                    Git Δ{gitWorktreeLines.length ? ` (${gitWorktreeLines.length})` : ""}
                  </button>
                  {gitStatusPopoverOpen ? (
                    <>
                      <div
                        className="header-menu-backdrop"
                        role="presentation"
                        aria-hidden
                        onClick={() => setGitStatusPopoverOpen(false)}
                      />
                      <div
                        className="header-menu-panel git-worktree-popover"
                        role="dialog"
                        aria-label="État du worktree Git"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="hint">
                          Lignes renvoyées par le daemon (max. 200) — même source que l’indicateur « propre » / ●.
                        </p>
                        {gitWorktreeLines.length === 0 ? (
                          <p className="hint">Aucune modification détectée (arbre propre).</p>
                        ) : (
                          <div className="git-worktree-table-wrap">
                            <table className="git-worktree-table">
                              <thead>
                                <tr>
                                  <th>Statut</th>
                                  <th>Chemin</th>
                                </tr>
                              </thead>
                              <tbody>
                                {gitWorktreeLines.map((row, idx) => (
                                  <tr key={`${row.path}-${idx}`}>
                                    <td>
                                      <code>{row.status}</code>
                                    </td>
                                    <td>
                                      <code>{row.path}</code>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </span>
              </span>
            </div>
          ) : (
            <span className="hint app-header-placeholder">Aucun projet chargé</span>
          )}
        </div>
      <nav className="app-header-nav" aria-label="Menus Code Studio">
        {openHeaderMenu ? (
          <div
            className="header-menu-backdrop"
            role="presentation"
            aria-hidden
            onClick={() => setOpenHeaderMenu(null)}
          />
        ) : null}

        <div className="header-menu-wrap">
          <button
            type="button"
            className="header-menu-trigger"
            data-testid="studio-project-settings-menu"
            aria-expanded={openHeaderMenu === "project"}
            onClick={() => setOpenHeaderMenu((m) => (m === "project" ? null : "project"))}
          >
            Projet
          </button>
          {openHeaderMenu === "project" ? (
            <div className="header-menu-panel" onClick={(e) => e.stopPropagation()}>
              <div className="project-actions-row">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setOpenHeaderMenu(null);
                    setModalCreateOpen(true);
                  }}
                >
                  Créer un projet
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  data-testid="studio-load-project"
                  onClick={() => {
                    setOpenHeaderMenu(null);
                    void (async () => {
                      await refreshProjects();
                      setModalLoadOpen(true);
                    })();
                  }}
                >
                  Charger un projet
                </button>
              </div>
              {selectedProject ? (
                <p className="hint sidebar-project-hint">
                  Projet actif : nom, identifiant court et branches dans l’en-tête.
                </p>
              ) : (
                <p className="hint">Aucun projet chargé — utilisez les actions ci-dessus.</p>
              )}
              {selectedId ? (
                <div className="project-settings">
                  <h2 className="header-menu-section-title">Paramètres du projet</h2>
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
                    <StackWizard
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
                  <div className="evolution-policy-box">
                    <p className="hint evolution-policy-intro">
                      Résumé produit (périmètre initial), résumé d’évolution et notes de politique : injectés dans les prochains
                      messages (daemon). Le résumé produit sert surtout au plan et au périmètre ; le résumé d’évolution à la
                      session ou à la branche courante.
                    </p>
                    <label className="field">
                      <span>Résumé produit (objectif de l’application)</span>
                      <textarea
                        className="evolution-policy-textarea"
                        rows={4}
                        spellCheck={false}
                        value={projectSummaryDraft}
                        onChange={(e) => setProjectSummaryDraft(e.target.value)}
                        placeholder="Ex. application à réaliser, utilisateurs cibles, fonctionnalités clés, contraintes…"
                      />
                    </label>
                    <label className="field">
                      <span>Résumé d’évolution / session</span>
                      <textarea
                        className="evolution-policy-textarea"
                        rows={4}
                        spellCheck={false}
                        value={evolutionSummaryDraft}
                        onChange={(e) => setEvolutionSummaryDraft(e.target.value)}
                        placeholder="Ex. objectif de la branche, décisions déjà prises, ce qu’il reste à faire…"
                      />
                    </label>
                    <label className="field">
                      <span>Notes de politique (outils, périmètre)</span>
                      <textarea
                        className="evolution-policy-textarea"
                        rows={4}
                        spellCheck={false}
                        value={policyNotesDraft}
                        onChange={(e) => setPolicyNotesDraft(e.target.value)}
                        placeholder="Ex. ne pas exécuter de commandes hors scripts/ ; pas de dépendances réseau sans accord…"
                      />
                    </label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void onSaveEvolutionAndPolicy()}>
                      Enregistrer résumés &amp; politique
                    </button>
                  </div>
                  <div className="evolution-policy-box">
                    <p className="hint evolution-policy-intro">
                      Critères de fin (Definition of Done) : texte libre ou JSON <code>criteria</code> avec{" "}
                      <code>manual</code>, <code>file_exists</code>, <code>command_ok</code> — envoyés avec chaque message
                      agent tant que le champ n’est pas vide (voir spec Code Studio).
                    </p>
                    <label className="field" htmlFor="acceptance-criteria-draft">
                      <span>Critères d&apos;acceptation (optionnel)</span>
                      <textarea
                        id="acceptance-criteria-draft"
                        className="evolution-policy-textarea"
                        rows={5}
                        spellCheck={false}
                        aria-label="Critères d'acceptation Code Studio"
                        data-testid="acceptance-criteria-draft"
                        value={acceptanceCriteriaDraft}
                        onChange={(e) => setAcceptanceCriteriaDraft(e.target.value)}
                        placeholder={
                          'Ex. liste en texte libre, ou JSON : {"criteria":[{"id":"1","text":"…","kind":"manual"},{"id":"2","text":"…","kind":"file_exists","path":"src/x.ts"}]}'
                        }
                      />
                    </label>
                  </div>
                  <div className="studio-danger-zone">
                    <h3 className="header-menu-section-title">Zone de danger</h3>
                    <p className="hint">
                      Supprime définitivement le dossier du projet sur ce poste (fichiers et dépôt Git locaux, index code du
                      daemon).
                    </p>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      data-testid="studio-delete-project-settings"
                      onClick={() => selectedProject && openDeleteProjectDialog(selectedProject)}
                    >
                      Supprimer ce projet…
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="header-menu-wrap">
          <button
            type="button"
            className="header-menu-trigger"
            aria-expanded={openHeaderMenu === "evolutions"}
            title="Créer/sélectionner une branche d’évolution Git"
            onClick={() => setOpenHeaderMenu((m) => (m === "evolutions" ? null : "evolutions"))}
          >
            Évolutions Git
          </button>
          {openHeaderMenu === "evolutions" ? (
            <div className="header-menu-panel" onClick={(e) => e.stopPropagation()}>
              <p className="hint">
                Branche de travail isolée pour une évolution (idée ou feature) ; fusionnez vers la branche principale depuis «
                Import &amp; build ».
              </p>
              <label className="field">
                <span>Label de branche (optionnel)</span>
                <input
                  value={evoLabel}
                  onChange={(e) => setEvoLabel(e.target.value)}
                  placeholder="ex. auth-login"
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                disabled={!selectedId}
                title={!selectedId ? "Chargez un projet pour créer une branche d’évolution." : undefined}
                onClick={() => void onNewEvolution()}
              >
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
            </div>
          ) : null}
        </div>

        <div className="header-menu-wrap header-menu-wrap--right">
          <button
            type="button"
            className="header-menu-trigger"
            aria-expanded={openHeaderMenu === "ops"}
            title="Importer un dépôt, lancer un build, fusionner ou abandonner une évolution"
            onClick={() => setOpenHeaderMenu((m) => (m === "ops" ? null : "ops"))}
          >
            Import &amp; build
          </button>
          {openHeaderMenu === "ops" ? (
            <div className="header-menu-panel" onClick={(e) => e.stopPropagation()}>
              <div className="ops-panel">
                <div className="ops-group ops-group--stacked">
                  <label className="field">
                    <span>URL du dépôt (HTTPS)</span>
                    <input
                      className="ops-input"
                      value={cloneUrl}
                      onChange={(e) => setCloneUrl(e.target.value)}
                      placeholder="https://github.com/…"
                      title="Adresse Git distante à cloner dans le dossier du projet Code Studio pour récupérer le code d’un dépôt distant."
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
                          .mergeEvolution(selectedId, selectedEvoId, { design_check: true })
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
            </div>
          ) : null}
        </div>

        <div className="header-menu-wrap header-menu-wrap--right">
          <button
            type="button"
            className="header-menu-trigger"
            aria-expanded={openHeaderMenu === "agent"}
            title="Actions agent (régénération plan/design, capacités)"
            onClick={() => setOpenHeaderMenu((m) => (m === "agent" ? null : "agent"))}
          >
            Agent / actions
          </button>
          {openHeaderMenu === "agent" ? (
            <div className="header-menu-panel" onClick={(e) => e.stopPropagation()}>
              {agentHint ? <p className="hint agent-hint">{agentHint}</p> : null}
              {!activeBranch ? (
                <p className="hint agent-branch-hint">
                  Aucune branche d’évolution sélectionnée : les messages utilisent la branche <strong>HEAD</strong> affichée
                  dans l’en-tête. Créez une branche dans « Évolutions Git » pour isoler une évolution.
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-block"
                disabled={!selectedId}
                title="Envoie une consigne à l’agent pour créer ou remplir CODE_STUDIO_PLAN.md"
                onClick={() => void onRegeneratePlan()}
              >
                Initialiser / régénérer le plan (CODE_STUDIO_PLAN.md)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-block"
                disabled={!selectedId}
                title="Envoie une consigne à l’agent pour créer ou compléter DESIGN.md"
                onClick={() => void onRegenerateDesign()}
              >
                Initialiser / régénérer le design (DESIGN.md)
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-block"
                disabled={!selectedId}
                title="Force une recréation de DESIGN.md à partir des styles réellement présents dans le dépôt."
                onClick={() => void onRegenerateDesign(true)}
              >
                Recréer DESIGN.md depuis le style du projet
              </button>
              <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={() => setShowAgentMatrix((v) => !v)}>
                {showAgentMatrix ? "Masquer" : "Afficher"} la matrice des capacités agents
              </button>
              {showAgentMatrix ? <AgentCapabilitiesTable /> : null}
            </div>
          ) : null}
        </div>

        <div className="app-header-nav-secondary">
          <label className="field-inline header-agent-inline">
            <span className="header-agent-label">Rôle agent</span>
            <select className="header-agent-select" value={agent} onChange={(e) => setAgent(e.target.value)}>
              {AGENT_OPTIONS.map((o) => (
                <option key={o.value || "auto"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <span
            className={`daemon-status-badge daemon-status-badge--${daemonStatus.ok ? "up" : "down"} header-daemon-status`}
            title={daemonStatus.detail ?? "Statut du daemon Akasha"}
            aria-label="Statut du daemon"
          >
            Daemon {daemonStatus.label}
          </span>

          <div className="split-toolbar" role="group" aria-label="Répartition éditeur et chat">
            <button
              type="button"
              className={`btn btn-ghost btn-sm${mainSplit === "center" ? " is-active" : ""}`}
              aria-pressed={mainSplit === "center"}
              onClick={() => setMainSplit("center")}
            >
              Plein éditeur
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-sm${mainSplit === "balanced" ? " is-active" : ""}`}
              aria-pressed={mainSplit === "balanced"}
              onClick={() => setMainSplit("balanced")}
            >
              50/50
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-sm${mainSplit === "chat" ? " is-active" : ""}`}
              aria-pressed={mainSplit === "chat"}
              onClick={() => setMainSplit("chat")}
            >
              Plein chat
            </button>
          </div>
        </div>
      </nav>
      </header>

      <div className={appMainClass}>
      <div className="center">
        <div className="center-tabs" role="tablist" aria-label="Navigation principale Code Studio">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={centerTab === tab.id}
              className={`center-tab ${centerTab === tab.id ? "active" : ""}`}
              onClick={() => setCenterTab(tab.id)}
              data-testid={tab.testId}
              title={`Ouvrir l’onglet ${tab.label}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {centerTab === "dashboard" ? (
          <div className="center-body">
            <ProjectDashboard
              project={dashboardProjectMeta}
              codeRagStatus={codeRagStatus ?? undefined}
              activeTask={dashboardActiveTask}
              lastSyncedAt={dashboardLastSyncAt}
              onStartAgent={() => {
                setMainSplit("chat");
              }}
              onOpenPlan={() => setCenterTab("plan")}
              onOpenDesign={() => setCenterTab("design")}
            />
          </div>
        ) : centerTab === "editor" ? (
          <div className="center-body editor-pane">
            <div className="editor-layout">
              <div className="editor-file-pane">
                <div className="editor-file-pane-header">
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
                  <p className="hint editor-file-pane-hint">Sélectionnez un projet pour voir ses fichiers.</p>
                ) : files.length === 0 ? (
                  <p className="hint editor-file-pane-hint">
                    Aucun fichier encore — envoyez une consigne à l’agent ou clonez un dépôt. Après une tâche terminée,
                    utilisez « Rafraîchir » si la liste ne se met pas à jour.
                  </p>
                ) : (
                  <div className="file-list-scroll">
                    <EditorFileTree
                      files={files}
                      activePath={filePath}
                      onOpenFile={(p) => void openFile(p)}
                      onDeleteFile={(p) => void onDeleteFile(p)}
                      onRenamePath={(from, to) => handleStudioRename(from, to)}
                    />
                  </div>
                )}
              </div>
              <div className="editor-editor-pane">
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
                  {isMarkdownPath(filePath) ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditorMarkdownPreview((v) => !v)}
                    >
                      {editorMarkdownPreview ? "Éditer Markdown" : "Preview Markdown"}
                    </button>
                  ) : null}
                </div>
                {editorMarkdownPreview && isMarkdownPath(filePath) ? (
                  <div className="markdown-doc-preview">
                    <MarkdownBlock text={editorText} className="md-content" />
                  </div>
                ) : (
                  <CodeEditor path={filePath} value={editorText} onChange={setEditorText} />
                )}
                <p className="hint editor-hint">
                  Les fichiers texte peuvent être enregistrés sur le disque du projet (bouton ou Ctrl+S). Le chat reste
                  utile pour des changements plus larges ou revus par l’agent.
                </p>
              </div>
            </div>
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
        ) : centerTab === "plan" ? (
          <div className="center-body plan-pane">
            <div className="preview-toolbar">
              <span className="pane-title-inline">CODE_STUDIO_PLAN.md</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!selectedId || planDocLoading}
                onClick={() => void onSavePlanFromTab()}
              >
                Enregistrer
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!selectedId}
                title="Mémorise la version courante pour comparer (session navigateur)"
                onClick={() => {
                  if (!selectedId) return;
                  setPlanDocSnapshot(planDocText);
                  try {
                    sessionStorage.setItem(`akasha-plan-snap-${selectedId}`, planDocText);
                  } catch { /* quota / private mode — snapshot skipped */ }
                  setStatus("Référence plan mise à jour pour comparaison");
                }}
              >
                Référence (diff)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={planDocLoading}
                onClick={() => setPlanMarkdownPreview((v) => !v)}
              >
                {planMarkdownPreview ? "Éditer Markdown" : "Preview Markdown"}
              </button>
            </div>
            {planDocLoading ? (
              <p className="hint">Chargement…</p>
            ) : (
              <>
                <p className="hint plan-pane-hint">
                  Édition directe du fichier à la racine du projet. La « référence » sert d’instantané local pour voir si
                  le texte a changé depuis le dernier marquage.
                </p>
                <p className="plan-diff-stats">
                  {planDocSnapshot && planDocSnapshot !== planDocText
                    ? `Écart avec la référence : ${planDocText.length} vs ${planDocSnapshot.length} caractères.`
                    : "Aucun écart avec la référence mémorisée (ou référence identique)."}
                </p>
                {planMarkdownPreview ? (
                  <div className="markdown-doc-preview">
                    <MarkdownBlock text={planDocText} className="md-content" />
                  </div>
                ) : (
                  <textarea
                    className="plan-doc-textarea"
                    spellCheck={false}
                    value={planDocText}
                    onChange={(e) => setPlanDocText(e.target.value)}
                    rows={28}
                    aria-label="Contenu de CODE_STUDIO_PLAN.md"
                  />
                )}
              </>
            )}
          </div>
        ) : centerTab === "design" ? (
          <div className="center-body plan-pane design-pane-root">
            <div className="preview-toolbar design-toolbar-wrap">
              <span className="pane-title-inline">DESIGN.md</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                data-testid="studio-save-design"
                disabled={!selectedId || designDocLoading}
                onClick={() => void onSaveDesignFromTab()}
              >
                Enregistrer
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!selectedId}
                onClick={() => onImportDesignFromDisk()}
              >
                Importer
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!designDocText} onClick={() => onExportDesignDoc()}>
                Export DESIGN.md
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!designDocText} onClick={() => onExportDesignTokens()}>
                Export tokens
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!designDocText} onClick={() => onExportDesignCss()}>
                Export CSS
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={designDocLoading}
                onClick={() => setDesignMarkdownPreview((v) => !v)}
              >
                {designMarkdownPreview ? "Éditer Markdown" : "Preview Markdown"}
              </button>
              <span className="design-view-toggle" role="group" aria-label="Affichage design">
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm${designViewMode === "split" ? " is-active" : ""}`}
                  aria-pressed={designViewMode === "split"}
                  onClick={() => setDesignViewMode("split")}
                >
                  Les deux
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm${designViewMode === "visual" ? " is-active" : ""}`}
                  aria-pressed={designViewMode === "visual"}
                  onClick={() => setDesignViewMode("visual")}
                >
                  Visuel
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm${designViewMode === "source" ? " is-active" : ""}`}
                  aria-pressed={designViewMode === "source"}
                  onClick={() => setDesignViewMode("source")}
                >
                  Source
                </button>
              </span>
            </div>
            {designDocLoading ? (
              <p className="hint">Chargement…</p>
            ) : (
              <>
                <p className="hint plan-pane-hint">
                  Contrat design projet (source de vérité agent/UI). Statut: <strong>{parsedDesignDoc.status}</strong>.
                </p>
                {parsedDesignDoc.status === "absent" ? (
                  <p className="hint plan-pane-hint">
                    Aucun `DESIGN.md` détecté. Utilisez “Initialiser / régénérer le design” pour le recréer à partir des
                    styles présents dans le projet.
                  </p>
                ) : null}
                <p className="plan-diff-stats">
                  {designDocSnapshot && designDocSnapshot !== designDocText
                    ? `Écart avec la référence : ${designDocText.length} vs ${designDocSnapshot.length} caractères.`
                    : "Aucun écart avec la référence mémorisée (ou référence identique)."}
                </p>
                <div className="design-diagnostics-row">
                  {parsedDesignDoc.diagnostics.length > 0 ? (
                    <ul className="design-diagnostics" aria-label="Diagnostics DESIGN.md">
                      {parsedDesignDoc.diagnostics.map((d, idx) => (
                        <li key={`${d.path}-${idx}`} className={`design-diagnostic design-diagnostic--${d.severity}`}>
                          <strong>{d.severity.toUpperCase()}</strong> {d.path}: {d.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {designHasFixableDiagnostics ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm design-fix-diagnostics-btn"
                      data-testid="studio-design-fix-diagnostics"
                      disabled={!selectedId}
                      title="Envoie une tâche à l’agent pour corriger uniquement DESIGN.md"
                      onClick={() => void onFixDesignDiagnostics()}
                    >
                      Demander à l’agent de corriger
                    </button>
                  ) : null}
                </div>
                {designViewMode === "split" ? (
                  <div className="design-pane-split">
                    <div className="design-visual-scroll">
                      <DesignVisualBoard parsed={parsedDesignDoc} />
                    </div>
                    <div className="design-editor-scroll">
                      {designMarkdownPreview ? (
                        <div className="markdown-doc-preview">
                          <MarkdownBlock text={designDocText} className="md-content" />
                        </div>
                      ) : (
                        <textarea
                          className="plan-doc-textarea"
                          spellCheck={false}
                          value={designDocText}
                          onChange={(e) => setDesignDocText(e.target.value)}
                          rows={28}
                          aria-label="Contenu de DESIGN.md"
                        />
                      )}
                    </div>
                  </div>
                ) : designViewMode === "visual" ? (
                  <div className="design-visual-only">
                    <div className="design-visual-scroll">
                      <DesignVisualBoard parsed={parsedDesignDoc} />
                    </div>
                  </div>
                ) : (
                  <div className="design-editor-scroll design-editor-only">
                    {designMarkdownPreview ? (
                      <div className="markdown-doc-preview">
                        <MarkdownBlock text={designDocText} className="md-content" />
                      </div>
                    ) : (
                      <textarea
                        className="plan-doc-textarea"
                        spellCheck={false}
                        value={designDocText}
                        onChange={(e) => setDesignDocText(e.target.value)}
                        rows={28}
                        aria-label="Contenu de DESIGN.md"
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : centerTab === "branches" ? (
          <div className="center-body plan-pane branches-pane">
            <div className="preview-toolbar branches-toolbar">
              <span className="pane-title-inline">Gestion des branches</span>
              <TooltipHint text="Comparez deux branches, faites un checkout ou un merge, puis surveillez les conflits détectés par Git." />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  void refreshGitBranches();
                  void refreshGitConflicts();
                }}
                title="Actualiser la liste des branches et l’état de conflit"
              >
                Rafraîchir
              </button>
            </div>
            <p className="hint plan-pane-hint">
              Suivez les branches locales, comparez les divergences et pilotez les merges depuis cet écran.
            </p>
            <div className="branches-layout">
              <section className="panel branches-panel">
                <h2>
                  Branches disponibles <TooltipHint text="Liste locale avec état courant, avance/retard et dernier commit." />
                </h2>
                {gitBranchesLoading ? <p className="hint">Chargement des branches…</p> : null}
                <ul className="branches-list">
                  {gitBranches.map((b) => (
                    <li key={b.name}>
                      <div className={`branches-item${b.current ? " is-current" : ""}`}>
                        <div className="branches-item-main">
                          <strong>{b.name}</strong>
                          {b.current ? <span className="branches-badge">active</span> : null}
                        </div>
                        <div className="branches-item-meta">
                          <span>↑ {b.ahead}</span>
                          <span>↓ {b.behind}</span>
                          <span>{b.last_commit_subject || "Aucun commit"}</span>
                        </div>
                        {!b.current ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => void onCheckoutBranch(b.name)}
                            title="Passer sur cette branche"
                          >
                            Checkout
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="panel branches-panel">
                <h2>
                  Comparer / merger <TooltipHint text="La branche source est fusionnée dans la branche cible." />
                </h2>
                <div className="field-row">
                  <label className="field">
                    <span>Branche cible</span>
                    <select value={gitCompareBase} onChange={(e) => { setGitCompareBase(e.target.value); setGitCompareResult(null); }}>
                      <option value="">Choisir…</option>
                      {gitBranches.map((b) => (
                        <option key={`base-${b.name}`} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Branche source</span>
                    <select value={gitCompareTarget} onChange={(e) => { setGitCompareTarget(e.target.value); setGitCompareResult(null); }}>
                      <option value="">Choisir…</option>
                      {gitBranches.map((b) => (
                        <option key={`target-${b.name}`} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="project-actions-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!gitCompareBase || !gitCompareTarget}
                    onClick={() => void onCompareBranches()}
                    title="Afficher les commits et statistiques de divergence"
                  >
                    Comparer
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!gitCompareBase || !gitCompareTarget || gitCompareBase === gitCompareTarget}
                    onClick={() => void onMergeBranches()}
                    title="Fusionner la branche source dans la cible"
                  >
                    Merger
                  </button>
                </div>
                {gitCompareResult ? (
                  <div className="branches-compare-summary">
                    <p className="hint">
                      {gitCompareResult.target} → {gitCompareResult.base} | ahead {gitCompareResult.ahead} / behind{" "}
                      {gitCompareResult.behind}
                    </p>
                    <p className="hint">
                      {gitCompareResult.files_changed} fichiers, +{gitCompareResult.insertions} / -
                      {gitCompareResult.deletions}
                    </p>
                    <ul className="branches-commit-list">
                      {gitCompareResult.commits.slice(0, 12).map((c) => (
                        <li key={c.hash}>
                          <code>{c.hash.slice(0, 8)}</code> {c.subject}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section className="panel branches-panel">
                <h2>
                  Conflits de merge <TooltipHint text="Affiche les fichiers en conflit; utilisez Annuler le merge pour revenir en arrière." />
                </h2>
                {gitMergeInProgress ? (
                  <p className="hint branches-warning">
                    Merge en cours avec conflits potentiels. Résolvez les fichiers puis commit, ou annulez le merge.
                  </p>
                ) : (
                  <p className="hint">Aucun merge en conflit détecté.</p>
                )}
                {gitConflicts.length > 0 ? (
                  <ul className="branches-conflict-list">
                    {gitConflicts.map((f) => (
                      <li key={f}>
                        <code>{f}</code>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={!gitMergeInProgress}
                  onClick={() => void onAbortMerge()}
                  title="Annuler le merge en cours et revenir à l’état précédent"
                >
                  Annuler le merge
                </button>
              </section>
            </div>
          </div>
        ) : centerTab === "cockpit" ? (
          <div className="center-body preview-pane preview-pane--cockpit">
            <div className="preview-toolbar">
              <span className="pane-title-inline">Cockpit opérateur</span>
              <p className="hint preview-logs-hint">
                Vue opérateur: scheduler, task runs, process watch, terminal/PTy, outils, mémoire, MCP et lifecycle.
              </p>
            </div>
            <DaemonOpsPanel />
          </div>
        ) : centerTab === "docs" ? (
          <div className="center-body plan-pane docs-pane">
            <div className="preview-toolbar">
              <span className="pane-title-inline">User documentation</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void window.open("/docs/USER_GUIDE.md", "_blank", "noopener,noreferrer")}
              >
                Open raw markdown
              </button>
            </div>
            <p className="hint plan-pane-hint">
              End-user guide rendered directly inside Code Studio, with the application visual theme.
            </p>
            {userGuideLoading ? (
              <p className="hint">Loading documentation…</p>
            ) : userGuideError ? (
              <div className="banner banner-error" role="alert">
                Failed to load documentation: {userGuideError}
              </div>
            ) : (
              <div className="docs-pane-layout">
                <aside className="docs-pane-toc" aria-label="Documentation table of contents">
                  <h3>On this page</h3>
                  {userGuideToc.length > 0 ? (
                    <ul className="docs-pane-toc-list">
                      {userGuideToc.map((item) => (
                        <li key={`${item.id}-${item.level}`} data-level={item.level}>
                          <a href={`#${item.id}`}>{item.label}</a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint">No sections found.</p>
                  )}
                </aside>
                <div className="docs-pane-content markdown-doc-preview" data-testid="studio-doc-content">
                  <MarkdownBlock text={userGuideDoc} className="md-content" />
                </div>
              </div>
            )}
          </div>
        ) : centerTab === "settings" ? (
          <div className="center-body plan-pane">
            <div className="preview-toolbar">
              <span className="pane-title-inline">Paramètres de l’application</span>
            </div>
            <Accordion
              items={[
                {
                  id: "appearance",
                  title: "Apparence",
                  icon: "🎨",
                  content: (
                    <div className="settings-form-group">
                      <div className="field-row">
                        <label className="field">
                          <span>Thème</span>
                          <select value={uiTheme} onChange={(e) => setUiTheme(e.target.value as typeof uiTheme)}>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                            <option value="compact-dark">Compact dark</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Densité</span>
                          <select value={uiDensity} onChange={(e) => setUiDensity(e.target.value as typeof uiDensity)}>
                            <option value="normal">Normale</option>
                            <option value="compact">Compacte</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ),
                  isOpen: true,
                },
                {
                  id: "conversation",
                  title: "Conversation",
                  icon: "💬",
                  content: (
                    <div className="settings-form-group">
                      <label className="field-inline delegate-single">
                        <input type="checkbox" checked={chatOptionsOpen} onChange={(e) => setChatOptionsOpen(e.target.checked)} />
                        <span>Options conversation ouvertes par défaut</span>
                      </label>
                      <label className="field-inline delegate-single">
                        <input type="checkbox" checked={chatSuggestionsOpen} onChange={(e) => setChatSuggestionsOpen(e.target.checked)} />
                        <span>Suggestions ouvertes par défaut</span>
                      </label>
                    </div>
                  ),
                  isOpen: false,
                },
                {
                  id: "build",
                  title: "Build & Logs",
                  icon: "🔨",
                  content: (
                    <div className="settings-form-group">
                      <label className="field-inline delegate-single">
                        <input type="checkbox" checked={buildLogOpen} onChange={(e) => setBuildLogOpen(e.target.checked)} />
                        <span>Journal de build ouvert par défaut</span>
                      </label>
                    </div>
                  ),
                  isOpen: false,
                },
                {
                  id: "info",
                  title: "Informations",
                  icon: "ℹ️",
                  content: (
                    <div className="settings-form-group">
                      <p className="hint">
                        Les paramètres sont persistés localement (navigateur) pour ce poste.
                      </p>
                    </div>
                  ),
                  isOpen: false,
                },
              ] as AccordionItem[]}
              allowMultiple
              className="settings-accordion"
            />
          </div>
        ) : (
          <div className="center-body preview-pane preview-pane--logs">
            <div className="preview-toolbar">
              <span className="pane-title-inline">Logs du serveur de dev</span>
              <p className="hint preview-logs-hint">
                Sortie standard et erreurs du processus <code>npm run dev</code> (Vite, etc.). Ouvrez cet onglet pour voir les erreurs de compilation ou du backend qui n’apparaissent pas dans l’iframe.
              </p>
            </div>
            <DevServerLogView
              text={devServerLog}
              emptyHint="— (lancez la prévisualisation puis revenez ici — rafraîchissement automatique)"
            />
          </div>
        )}
      </div>

      <div className="chat-column">
        <aside className="chat-panel">
        {selectedId ? (
          <div className="sandbox-reminder" role="status">
            Sandbox disque : <code>{selectedId.slice(0, 8)}…</code> — les outils agent sont limités à ce dossier projet
            (voir daemon / policy).
          </div>
        ) : null}
        {pendingInbox.length > 1 ? (
          <div className="pending-inbox-banner" role="status">
            {pendingInbox.length} tâche(s) en attente de réponse (file globale — ouvrez la bonne dans l’UI principale
            Akasha si besoin).
          </div>
        ) : null}

        <div className="chat-activity-area">
          {taskTrace ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void onOpenTaskDetailModal(taskTrace.id)}
              title="Ouvrir la modale de détail de la tâche"
            >
              Tâche en cours
            </button>
          ) : null}
          {pendingHumanInput && taskTrace && pendingHumanInput.taskId === taskTrace.id ? (
            <div className="task-human-input">
              {humanInputRiskLevel ? (
                <span
                  className={`risk-badge risk-badge--${humanInputRiskLevel}`}
                  title="Estimation locale (mots-clés) — pas une analyse serveur"
                >
                  {riskLabel(humanInputRiskLevel)}
                </span>
              ) : null}
              <p className="task-human-input-question">{pendingHumanInput.question}</p>
              {pendingHumanInput.context ? <p className="task-human-input-context">{pendingHumanInput.context}</p> : null}
              {pendingHumanInput.choices?.length ? (
                <div className="task-human-input-choices">
                  {pendingHumanInput.choices.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={humanReplyBusy}
                      onClick={() => setHumanReplyDraft(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : null}
              {humanRefusalStreak >= 2 && looksLikeStructuredRefusal(humanReplyDraft) ? (
                <p className="denial-loop-hint" role="status">
                  Plusieurs refus d’affilée : précisez une <strong>question</strong> ou une <strong>alternative</strong>{" "}
                  pour éviter que l’agent réessaie la même action.
                </p>
              ) : null}
              <textarea
                className="task-human-input-textarea"
                value={humanReplyDraft}
                onChange={(e) => setHumanReplyDraft(e.target.value)}
                placeholder="Réponse pour débloquer la tâche…"
                rows={3}
                disabled={humanReplyBusy}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm task-human-input-submit"
                disabled={humanReplyBusy || !humanReplyDraft.trim()}
                onClick={() => void onSubmitHumanReply()}
              >
                {humanReplyBusy ? "Envoi…" : "Envoyer la réponse à l’agent"}
              </button>
            </div>
          ) : null}

          <section className="chat-conversation-panel" aria-label="Conversation agent">
            <div className="pane-title pane-title--compact">Conversation</div>
            {chatHasUnseen ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm chat-unseen-btn"
                onClick={() => {
                  const el = chatLogRef.current;
                  if (!el) return;
                  el.scrollTop = el.scrollHeight;
                  chatPinnedByUserRef.current = false;
                  setChatHasUnseen(false);
                }}
              >
                Nouveaux messages — aller en bas
              </button>
            ) : null}
            <div
              className="chat-log"
              ref={chatLogRef}
              onScroll={() => {
                const el = chatLogRef.current;
                if (!el) return;
                const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 56;
                chatPinnedByUserRef.current = !nearBottom;
                if (nearBottom) setChatHasUnseen(false);
              }}
            >
              {chat.map((m, i) => (
                <div key={i} className={`bubble ${m.role}`}>
                  <div className="bubble-inner">
                    <MarkdownBlock text={m.text} className="md-content md-content--bubble" />
                    {m.role === "user" && m.task_id ? (
                      <button
                        type="button"
                        className="bubble-task-detail-btn"
                        aria-label="Fork à partir de ce message"
                        title="Fork à partir d’ici"
                        onClick={() => onOpenForkDialog(i, m)}
                      >
                        ⎇
                      </button>
                    ) : null}
                    {m.role === "assistant" && m.task_id ? (
                      <button
                        type="button"
                        className="bubble-task-detail-btn"
                        aria-label="Détails de la tâche"
                        title="Voir statut, progression et événements daemon"
                        onClick={() => void onOpenTaskDetailModal(m.task_id!)}
                      >
                        ℹ
                      </button>
                    ) : null}
                    {m.role === "assistant" && m.studio_diff?.files?.length ? (
                      <ChatStudioDiffPanel
                        diff={m.studio_diff}
                        projectId={selectedId}
                        onApplied={() => void refreshFiles()}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {lastAssistant?.suggested_actions && lastAssistant.suggested_actions.length > 0 ? (
              <div className="chat-suggestions" aria-label="Prochaines étapes suggérées">
                <details open={chatSuggestionsOpen} onToggle={(e) => setChatSuggestionsOpen((e.currentTarget as HTMLDetailsElement).open)}>
                  <summary className="chat-suggestions-label">Suggestions ({lastAssistant.suggested_actions.length})</summary>
                  <div className="chat-suggestion-chips">
                    {lastAssistant.suggested_actions.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="btn btn-ghost btn-sm chat-suggestion-chip"
                        onClick={() => {
                          if (a.kind === "message" && a.message) setChatInput(a.message);
                          if (a.kind === "ui") applyUiSuggestedAction(a.ui_action);
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}
          </section>
        </div>

        <div className="chat-panel-footer">
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
          <div className="chat-controls-row">
            <button
              type="button"
              className="btn btn-ghost btn-sm chat-options-toggle"
              onClick={() => setChatOptionsOpen((v) => !v)}
              title="Afficher ou masquer les options avancées"
            >
              {chatOptionsOpen ? "Masquer options" : "Options"}
            </button>
            <p className="kbd-hint">
              Raccourci : <kbd>Ctrl</kbd>+<kbd>Entrée</kbd>
            </p>
          </div>
          {chatOptionsOpen ? (
            <div className="chat-options-panel">
              <div className="code-mode-strip" role="group" aria-label="Mode Code Studio">
                {CODE_MODE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`code-mode-pill ${codeMode === o.value ? "active" : ""}`}
                    title={o.hint}
                    onClick={() => setCodeMode(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <label className="field chat-policy-hint-field">
                <span>Consigne ponctuelle (optionnel, un envoi)</span>
                <input
                  type="text"
                  value={policyHintOneShot}
                  onChange={(e) => setPolicyHintOneShot(e.target.value)}
                  placeholder="Ex. ne pas toucher au dossier legacy/…"
                  spellCheck={false}
                />
              </label>
              <label
                className="field-inline delegate-single"
                title="Désactivé (défaut) : le chef de projet doit router la demande via delegate_to_agent vers un spécialiste. Activé : une seule passe sans sous-agents."
              >
                <input
                  type="checkbox"
                  checked={delegateSingleLevel}
                  onChange={(e) => setDelegateSingleLevel(e.target.checked)}
                />
                <span>Délégation simple (sans sous-agents)</span>
              </label>
              <label className="field-inline delegate-single">
                <input
                  type="checkbox"
                  checked={autoApplyDesign}
                  onChange={(e) => setAutoApplyDesign(e.target.checked)}
                />
                <span>Auto-apply DESIGN.md ({parsedDesignDoc.status})</span>
              </label>
              {autoApplyDesign && designHint ? (
                <p className="hint chat-design-hint" title={designHint}>
                  Design actif: {designHint}
                </p>
              ) : null}
              <details open={buildLogOpen} onToggle={(e) => setBuildLogOpen((e.currentTarget as HTMLDetailsElement).open)}>
                <summary className="pane-title">Journal de build</summary>
                <pre className="build-pre">{buildLog || "—"}</pre>
              </details>
            </div>
          ) : null}
        </div>
      </aside>
      </div>
    </div>

      {taskDetailForId ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setTaskDetailForId(null)}
          onKeyDown={(e) => e.key === "Escape" && setTaskDetailForId(null)}
        >
          <div
            className="modal-card modal-card--task-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card-head">
              <h3 id="task-detail-title">Détail de la tâche</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTaskDetailForId(null)}>
                Fermer
              </button>
            </div>
            <div className="task-detail-scroll">
              {taskDetailLoading ? <p className="hint">Chargement…</p> : null}
              {taskDetailError ? <div className="banner banner-error">{taskDetailError}</div> : null}
              {!taskDetailLoading && !taskDetailError && taskDetailPayload ? (
                <>
                  <div className="task-detail-tabs" role="tablist" aria-label="Navigation détail tâche">
                    {[
                      { id: "events", label: "Événements" },
                      { id: "progress", label: "Progression" },
                      { id: "workflow", label: "Workflow" },
                      { id: "summary", label: "Résumé" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={taskDetailTab === tab.id}
                        className={`task-detail-tab ${taskDetailTab === tab.id ? "is-active" : ""}`}
                        onClick={() => setTaskDetailTab(tab.id as typeof taskDetailTab)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {taskDetailTab === "summary" ? (
                    <section className="task-detail-section">
                      <h4>Résumé</h4>
                      <p>
                        <code>{taskDetailPayload.task.task_id}</code> — {formatTaskStatusFr(taskDetailPayload.task.status)}
                      </p>
                      {taskDetailLiveMode ? (
                        <p className="hint">
                          Flux live: <strong>{taskDetailLiveMode === "sse" ? "SSE (/api/events)" : "polling fallback"}</strong>
                        </p>
                      ) : null}
                      {taskDetailPayload.task.assigned_agent ? (
                        <p className="hint">Agent assigné : {taskDetailPayload.task.assigned_agent}</p>
                      ) : null}
                      {taskDetailPayload.task.failure_detail ? (
                        <pre className="task-detail-failure">{taskDetailPayload.task.failure_detail}</pre>
                      ) : null}
                    </section>
                  ) : null}
                  {taskDetailTab === "workflow" ? (
                    <section className="task-detail-section">
                      <h4>Workflow / sous-agents</h4>
                      <TaskDetailWorkflowView
                        events={taskDetailPayload.events}
                        rootTaskId={taskDetailPayload.task.task_id}
                      />
                    </section>
                  ) : null}
                  {taskDetailTab === "progress" ? (
                    <section className="task-detail-section">
                      <h4>Progression</h4>
                      {(() => {
                        const mergedProgress = mergeProgressWithEventProgress(
                          taskDetailPayload.task.progress ?? [],
                          taskDetailPayload.events,
                          taskDetailPayload.task.task_id,
                        );
                        return mergedProgress.length > 0 ? (
                          <TaskDetailProgressView
                            progress={mergedProgress}
                            rootTaskId={taskDetailPayload.task.task_id}
                          />
                        ) : (
                          <p className="hint">Aucune entrée de progression.</p>
                        );
                      })()}
                    </section>
                  ) : null}
                  {taskDetailTab === "events" ? (
                    <section className="task-detail-section">
                      <h4>Événements</h4>
                      {taskDetailPayload.events.length === 0 ? (
                        <p className="hint">Aucun événement.</p>
                      ) : (
                        <TaskDetailEventsGrouped
                          events={taskDetailPayload.events}
                          rootTaskId={taskDetailPayload.task.task_id}
                        />
                      )}
                    </section>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {forkDialog?.open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setForkDialog(null)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-fork-title"
            tabIndex={-1}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setForkDialog(null)}
          >
            <h3 id="modal-fork-title">Nouvelle branche de conversation</h3>
            <p className="hint">
              Point de fork: message #{forkDialog.index + 1}. Une nouvelle tâche sera créée avec un contexte
              tronqué jusqu’à ce point.
            </p>
            <label className="field">
              <span>Instruction initiale</span>
              <textarea
                value={forkInitialInstruction}
                onChange={(e) => setForkInitialInstruction(e.target.value)}
                rows={5}
                spellCheck={false}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setForkDialog(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!forkInitialInstruction.trim()}
                onClick={() => void onCreateFork()}
              >
                Créer la branche
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                  <li key={p.id} className="project-list-row">
                    <button
                      type="button"
                      className={`project-item ${p.id === selectedId ? "active" : ""}`}
                      data-testid={`studio-project-${p.id}`}
                      onClick={() => {
                        setSelectedId(p.id);
                        setCenterTab("dashboard");
                        setModalLoadOpen(false);
                      }}
                    >
                      <span className="project-name">{p.name}</span>
                      <span className="project-id">{p.id.slice(0, 8)}…</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm project-delete-btn"
                      aria-label={`Supprimer le projet ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteProjectDialog(p);
                      }}
                    >
                      Supprimer
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
              <StackWizard
                presetId={newStackPresetId}
                onPresetChange={onNewStackPresetSelect}
                customText={newStackCustomText}
                onCustomTextChange={setNewStackCustomText}
                addons={newStackAddons}
                onToggleAddon={toggleNewStackAddon}
                composedStack={newProjectComposedStack}
              />
            </div>
            <label className="field">
              <span>Résumé de l’application (recommandé)</span>
              <textarea
                value={newProjectSummary}
                onChange={(e) => setNewProjectSummary(e.target.value)}
                placeholder="Décrivez ce que l’application doit faire : public, fonctionnalités, contraintes. Sert de base au plan (CODE_STUDIO_PLAN.md), au DESIGN.md et au contexte agent."
                rows={5}
                spellCheck={false}
              />
            </label>
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

      {deleteProjectDialog ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !deleteProjectBusy && setDeleteProjectDialog(null)}
          onKeyDown={(e) => e.key === "Escape" && !deleteProjectBusy && setDeleteProjectDialog(null)}
        >
          <div
            className="modal-card modal-card--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-delete-project-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="modal-delete-project-title">Supprimer le projet</h3>
            <p>
              <strong>{deleteProjectDialog.name}</strong>
              <code className="studio-delete-id">{deleteProjectDialog.id.slice(0, 8)}…</code>
            </p>
            <p className="hint">Le dossier du projet sur ce poste sera effacé (y compris le dépôt Git local).</p>
            {deletePrecheckLoading ? (
              <p className="hint">Analyse Git…</p>
            ) : deletePrecheck ? (
              <>
                {deletePrecheck.note_no_upstream ? (
                  <p className="hint studio-delete-note">
                    Branche locale sans suivi distant — impossible de vérifier si des commits ont été poussés. Si vous utilisez
                    un dépôt distant, configurez le suivi puis <code>git push</code> avant de supprimer.
                  </p>
                ) : null}
                {deletePrecheck.worktree_dirty ? (
                  <p className="hint studio-delete-warn">
                    <strong>Attention :</strong> des fichiers ne sont pas commités. Vous perdrez ces modifications si vous
                    supprimez sans sauvegarder.
                  </p>
                ) : null}
                {deletePrecheck.has_upstream &&
                deletePrecheck.commits_ahead_of_upstream != null &&
                deletePrecheck.commits_ahead_of_upstream > 0 ? (
                  <p className="hint studio-delete-warn">
                    <strong>Attention :</strong> {deletePrecheck.commits_ahead_of_upstream} commit(s) ne sont pas encore
                    poussés vers le distant.
                  </p>
                ) : null}
                {deletePrecheck.requires_force ? (
                  <>
                    <p className="hint">Pour sauvegarder dans Git avant suppression, dans un terminal à la racine du projet :</p>
                    <pre className="studio-delete-git-help">
                      {`git add -A
git status
git commit -m "Sauvegarde avant suppression"
git push`}
                    </pre>
                  </>
                ) : null}
              </>
            ) : null}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleteProjectBusy}
                onClick={() => setDeleteProjectDialog(null)}
              >
                Annuler
              </button>
              {!deletePrecheckLoading && deletePrecheck?.requires_force ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleteProjectBusy || !deletePrecheck}
                  onClick={() => void onConfirmDeleteProject(true)}
                >
                  {deleteProjectBusy ? "Suppression…" : "Supprimer quand même"}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleteProjectBusy || deletePrecheckLoading || !deletePrecheck}
                  onClick={() => void onConfirmDeleteProject(false)}
                >
                  {deleteProjectBusy ? "Suppression…" : "Supprimer"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
}
