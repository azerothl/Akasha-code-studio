import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api";
import { loadChatMessages, saveChatMessages, type ChatMessage } from "../chatStorage";
import { clearActiveTask, loadActiveTask } from "../taskStorage";
import { inferActionRisk, type ActionRiskLevel } from "../inferActionRisk";
import type * as React from "react";
import { dedupeProgressForTrace, isStubProgressMessage, formatTaskStatusFr, chatMessageForTerminalTask } from "../studioUiModel";

type Dependencies = {
  selectedId: string | null;
  setAcceptanceCriteriaDraft: React.Dispatch<React.SetStateAction<string>>;
  setFiles: React.Dispatch<React.SetStateAction<string[]>>;
  syncCodeRagAfterFileChange: (projectId: string) => void;
  filePathRef: React.MutableRefObject<string | null>;
  editorDirtyRef: React.MutableRefObject<boolean>;
  editorBinaryRef: React.MutableRefObject<boolean>;
  setEditorText: React.Dispatch<React.SetStateAction<string>>;
  setSavedEditorText: React.Dispatch<React.SetStateAction<string>>;
  setStaticPreviewBlobUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setForkEvents: React.Dispatch<React.SetStateAction<api.TaskEventEntry[]>>;
};

export function useStudioTasks({ selectedId, setAcceptanceCriteriaDraft, setFiles, syncCodeRagAfterFileChange, filePathRef, editorDirtyRef, editorBinaryRef, setEditorText, setSavedEditorText, setStaticPreviewBlobUrl, setForkEvents }: Dependencies) {

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [lastObservedModel, setLastObservedModel] = useState("");

  const [taskTrace, setTaskTrace] = useState<{
    id: string;
    status: string;
    line: string;
    done: boolean;
    outcome?: api.TaskOutcome | null;
    /** Étiquettes courtes dérivées des progressions daemon. */
    progressChips?: string[];
  } | null>(null);

  /** Réponse attendue par le daemon (`ask_user`, approbation, …) — alimenté par GET …/human-input. */
  const [pendingHumanInput, setPendingHumanInput] = useState<{
    taskId: string;
    requestId?: string | null;
    question: string;
    context: string;
    choices: string[] | null;
  } | null>(null);

  const [humanReplyDraft, setHumanReplyDraft] = useState("");

  const [humanReplyBusy, setHumanReplyBusy] = useState(false);

  /** Annule le polling en cours (nouveau message ou démontage du composant). */
  const pollTaskAbortRef = useRef<AbortController | null>(null);

  const [pendingInbox, setPendingInbox] = useState<api.TaskHumanInputPayload[]>([]);

  /** Refus structurés consécutifs pour la même demande utilisateur (évite boucles côté agent). */
  const [humanRefusalStreak, setHumanRefusalStreak] = useState(0);

  const skipChatSaveOnce = useRef(false);

  const chatLogRef = useRef<HTMLDivElement | null>(null);

  const chatPinnedByUserRef = useRef(false);

  const [chatHasUnseen, setChatHasUnseen] = useState(false);

  const dashboardActiveTask = useMemo(() => {
    if (!selectedId || !taskTrace || taskTrace.done) return null;
    const stored = loadActiveTask(selectedId);
    return {
      taskId: taskTrace.id,
      startedAt: stored?.startedAt ?? Date.now(),
    };
  }, [selectedId, taskTrace]);

  useEffect(() => {
    pollTaskAbortRef.current?.abort();
    setTaskTrace(null);
    setLastObservedModel("");
    setPendingHumanInput(null);
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

  const pollTask = useCallback(
    async (taskId: string, signal: AbortSignal, studioProjectId: string | null) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      try {
        while (!signal.aborted) {
          const t = await api.getTask(taskId);
          if (signal.aborted) return;
          if (t.last_turn_model_used) setLastObservedModel(t.last_turn_model_used);

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
              requestId: hi.request_id,
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
            outcome: t.outcome,
          });
          if (api.isTaskTerminal(t.status) || api.isTaskNeedsUser(t.status)) {
            if (studioProjectId && api.isTaskTerminal(t.status)) {
              clearActiveTask(studioProjectId);
            }
            if (api.isTaskTerminal(t.status) && selectedId) {
              try {
                const fl = await api.listFiles(selectedId);
                if (signal.aborted) return;
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
                    if (signal.aborted) return;
                    if (filePathRef.current === fp && !editorDirtyRef.current) {
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
            if (signal.aborted) return;
            setChat((c) => [
              ...c,
              {
                role: "assistant",
                text: summary,
                task_id: taskId,
                task_status: t.status,
                task_outcome: t.outcome,
                suggested_actions: t.suggested_actions,
              },
            ]);
            void (async () => {
              try {
                const sd = await api.getTaskStudioDiff(taskId);
                if (signal.aborted || !sd?.files?.length) return;
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
          prev ? { ...prev, status: "interrupted", line: `Suivi interrompu : ${e}`, done: true } : null,
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
      } catch (error) {
        if (!cancelled) setTaskTrace({
          id: stored.taskId,
          status: "interrupted",
          line: `Suivi indisponible : ${error}`,
          done: true,
        });
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
    const taskId = taskTrace?.id;
    if (!taskId) {
      setForkEvents([]);
      return;
    }
    let cancelled = false;
    void api.getTaskEvents(taskId).then((events) => {
      if (!cancelled) setForkEvents(events.filter((event) => event.event_type === "session_fork_created"));
    }).catch(() => {
      if (!cancelled) setForkEvents([]);
    });
    return () => {
      cancelled = true;
    };
  }, [taskTrace?.id]);

  const humanInputRiskLevel = useMemo((): ActionRiskLevel | null => {
    if (!pendingHumanInput) return null;
    return inferActionRisk(`${pendingHumanInput.question}\n${pendingHumanInput.context}`);
  }, [pendingHumanInput]);

  useEffect(() => {
    setHumanRefusalStreak(0);
    setHumanReplyDraft("");
  }, [pendingHumanInput?.taskId, pendingHumanInput?.requestId]);

  const lastAssistant = useMemo(() => {
    for (let i = chat.length - 1; i >= 0; i -= 1) {
      if (chat[i]?.role === "assistant") return chat[i];
    }
    return null;
  }, [chat]);
  const resumeTaskTracking = useCallback((taskId: string) => {
    pollTaskAbortRef.current?.abort();
    const controller = new AbortController();
    pollTaskAbortRef.current = controller;
    setTaskTrace({ id: taskId, status: "running", line: "Reprise du suivi…", done: false });
    void pollTask(taskId, controller.signal, selectedId);
  }, [pollTask, selectedId]);

  return {
    lastObservedModel,
    resumeTaskTracking,
    pollTaskAbortRef,
    setPendingHumanInput,
    setHumanReplyDraft,
    setTaskTrace,
    setChat,
    pollTask,
    taskTrace,
    pendingHumanInput,
    humanReplyDraft,
    humanRefusalStreak,
    setHumanRefusalStreak,
    setHumanReplyBusy,
    dashboardActiveTask,
    pendingInbox,
    humanInputRiskLevel,
    humanReplyBusy,
    chat,
    chatHasUnseen,
    chatLogRef,
    chatPinnedByUserRef,
    setChatHasUnseen,
    lastAssistant
  };
}
