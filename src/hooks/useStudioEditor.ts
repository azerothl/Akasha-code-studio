import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api";
import { bufferDirty, closeBuffer, markBufferSaved, searchTextFiles, touchBufferText, upsertBuffer, type EditorBuffer, type SearchHit } from "../editorSession";
import type * as React from "react";
import type { CenterTab } from "../studioNavigation";
import { isMarkdownPath } from "../studioUiModel";

type Dependencies = {
  selectedId: string | null;
  setStaticPreviewBlobUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  syncCodeRagAfterFileChange: (projectId: string) => void;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  centerTab: CenterTab;
};

export function useStudioEditor({ selectedId, setStaticPreviewBlobUrl, setError, syncCodeRagAfterFileChange, setStatus, centerTab }: Dependencies) {

  const [files, setFiles] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState<{ query: string; scanned: number; skipped: number } | null>(null);
  const projectRef = useRef(selectedId);
  projectRef.current = selectedId;
  const openRequest = useRef(0);
  const filesRequest = useRef(0);
  const searchRequest = useRef(0);

  const [filePath, setFilePath] = useState<string | null>(null);

  const [editorText, setEditorText] = useState("");

  /** Dernière version connue sur le daemon (après ouverture ou enregistrement réussi). */
  const [savedEditorText, setSavedEditorText] = useState("");

  /** Fichier ouvert en mode binaire (pas de champ `content` dans la réponse raw). */
  const [editorBinary, setEditorBinary] = useState(false);

  const [editorBuffers, setEditorBuffers] = useState<EditorBuffer[]>([]);

  const [editorQuickQuery, setEditorQuickQuery] = useState("");

  const [editorSearchQuery, setEditorSearchQuery] = useState("");

  const [editorSearchHits, setEditorSearchHits] = useState<SearchHit[]>([]);

  const [editorSearchBusy, setEditorSearchBusy] = useState(false);

  const [editorDiagnostics, setEditorDiagnostics] = useState<{ line: number; message: string }[]>([]);

  const editorDirtyRef = useRef(false);

  const filePathRef = useRef<string | null>(null);

  const editorBinaryRef = useRef(false);

  const editorBuffersRef = useRef<EditorBuffer[]>([]);

  const [editorMarkdownPreview, setEditorMarkdownPreview] = useState(false);

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
    editorBuffersRef.current = editorBuffers;
  }, [editorBuffers]);

  useEffect(() => {
    setEditorBuffers([]);
    setEditorSearchHits([]);
    setEditorQuickQuery("");
    setEditorDiagnostics([]);
    setFilePath(null);
    setEditorText("");
    setSavedEditorText("");
    setEditorBinary(false);
    setEditorError(null);
    setEditorLoading(false);
    setEditorSearchBusy(false);
    setSearchSummary(null);
    return () => { openRequest.current++; filesRequest.current++; searchRequest.current++; };
  }, [selectedId]);

  const loadFiles = useCallback(async () => {
    const request = ++filesRequest.current;
    if (!selectedId) { setFiles([]); setFilesLoading(false); setFilesError(null); return []; }
    setFilesLoading(true);
    setFilesError(null);
    try {
      const list = await api.listFiles(selectedId);
      if (request === filesRequest.current && projectRef.current === selectedId) setFiles(list);
      return list;
    } catch (error) {
      if (request === filesRequest.current && projectRef.current === selectedId) setFilesError(String(error));
      return null;
    } finally {
      if (request === filesRequest.current && projectRef.current === selectedId) setFilesLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { setFiles([]); void loadFiles(); }, [loadFiles]);

  // Remote task refreshes also update the saved buffer, including inactive tabs.
  useEffect(() => {
    if (!filePath) return;
    setEditorBuffers((previous) => previous.map((buffer) => buffer.path === filePath &&
      (buffer.text !== editorText || buffer.savedText !== savedEditorText)
      ? { ...buffer, text: editorText, savedText: savedEditorText } : buffer));
  }, [filePath, editorText, savedEditorText]);

  useEffect(() => {
    if (!isMarkdownPath(filePath)) setEditorMarkdownPreview(false);
  }, [filePath]);

  const reloadOpenFileFromServer = useCallback(async () => {
    if (!selectedId || !filePath || editorBinary) return;
    try {
      const raw = await api.readRawFile(selectedId, filePath);
      if (projectRef.current !== selectedId || filePathRef.current !== filePath || editorDirtyRef.current) return;
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

  const activateBuffer = useCallback((buffer: EditorBuffer) => {
    openRequest.current++;
    setEditorLoading(false);
    filePathRef.current = buffer.path;
    editorBinaryRef.current = buffer.binary;
    editorDirtyRef.current = bufferDirty(buffer);
    setFilePath(buffer.path);
    setEditorText(buffer.text);
    setSavedEditorText(buffer.savedText);
    setEditorBinary(buffer.binary);
    setEditorDiagnostics([]);
  }, []);

  const openFile = useCallback(
    async (path: string) => {
      if (!selectedId || !path) return;
      const request = ++openRequest.current;
      const current = () => request === openRequest.current && projectRef.current === selectedId;
      const existing = editorBuffersRef.current.find((buffer) => buffer.path === path);
      if (existing) {
        setEditorLoading(false);
        setEditorError(null);
        activateBuffer(existing);
        return;
      }
      setEditorError(null);
      setEditorLoading(true);
      try {
        const raw = await api.readRawFile(selectedId, path);
        if (!current()) return;
        setFilePath(path);
        const text = raw.content;
        const isBinary = text === undefined && Boolean(raw.content_base64);
        if (isBinary) {
          const buffer: EditorBuffer = {
            path,
            text: "(binaire — enregistrement depuis l’éditeur non disponible)",
            savedText: "",
            binary: true,
          };
          setEditorBinary(true);
          setEditorText(buffer.text);
          setSavedEditorText("");
          setEditorBuffers((prev) => upsertBuffer(prev, buffer));
          setStaticPreviewBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        } else {
          const body = text ?? "";
          const buffer: EditorBuffer = { path, text: body, savedText: body, binary: false };
          setEditorBinary(false);
          setEditorText(body);
          setSavedEditorText(body);
          setEditorBuffers((prev) => upsertBuffer(prev, buffer));
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
        if (current()) setEditorError(String(e));
      } finally {
        if (current()) setEditorLoading(false);
      }
    },
    [selectedId, activateBuffer],
  );

  const closeEditorTab = useCallback(
    (path: string) => {
      const buffer = editorBuffersRef.current.find((row) => row.path === path);
      if (buffer && bufferDirty(buffer)) {
        const ok = window.confirm(`Fermer « ${path} » et perdre les modifications non enregistrées ?`);
        if (!ok) return;
      }
      const next = closeBuffer(editorBuffersRef.current, path);
      setEditorBuffers(next);
      if (filePathRef.current !== path) return;
      const fallback = next[next.length - 1];
      if (fallback) activateBuffer(fallback);
      else {
        setFilePath(null);
        setEditorText("");
        setSavedEditorText("");
        setEditorBinary(false);
      }
    },
    [activateBuffer],
  );

  const onEditorChange = useCallback((value: string) => {
    setEditorText(value);
    editorBuffersRef.current = touchBufferText(editorBuffersRef.current, filePathRef.current, value);
    editorDirtyRef.current = true;
    setEditorBuffers((prev) => touchBufferText(prev, filePathRef.current, value));
  }, []);

  const onSearchProject = useCallback(async () => {
    const request = ++searchRequest.current;
    if (!selectedId || !editorSearchQuery.trim()) {
      setEditorSearchHits([]);
      setSearchSummary(null);
      setEditorSearchBusy(false);
      return;
    }
    const current = () => request === searchRequest.current && projectRef.current === selectedId;
    setEditorSearchBusy(true);
    setSearchSummary(null);
    setEditorSearchHits([]);
    try {
      const buffers = new Map(editorBuffersRef.current.filter(b => !b.binary).map(b => [b.path, b.text]));
      const candidates = files.filter(path => !/\.(png|jpg|jpeg|gif|webp|ico|woff2?|pdf|zip|exe|dll)$/i.test(path));
      let cursor = 0, skipped = 0;
      const results: SearchHit[][] = [];
      await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
        while (current() && cursor < candidates.length) {
          const index = cursor++;
          const path = candidates[index];
          try {
            const text = buffers.get(path) ?? (await api.readRawFile(selectedId, path)).content;
            if (typeof text === "string") results[index] = searchTextFiles([{ path, text }], editorSearchQuery);
            else skipped++;
          } catch { skipped++; }
        }
      }));
      if (current()) {
        setEditorSearchHits(results.flat().slice(0, 40));
        setSearchSummary({ query: editorSearchQuery.trim(), scanned: candidates.length, skipped });
      }
    } finally {
      if (current()) setEditorSearchBusy(false);
    }
  }, [selectedId, editorSearchQuery, files]);

  const confirmDiscardDrafts = useCallback(() => {
    const dirty = editorBuffersRef.current.filter(bufferDirty);
    if (dirty.length === 0) return true;
    return window.confirm(
      `Des brouillons non enregistrés (${dirty.map((row) => row.path).join(", ")}) seront perdus. Continuer ?`,
    );
  }, []);

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
        if (projectRef.current !== selectedId) return;
        let nextOpen = opened;
        if (opened === from) nextOpen = to;
        else if (opened?.startsWith(`${from}/`)) nextOpen = to + opened.slice(from.length);
        if (nextOpen !== opened) setFilePath(nextOpen);
        setEditorBuffers((prev) =>
          prev.map((buffer) => {
            if (buffer.path === from) return { ...buffer, path: to };
            if (buffer.path.startsWith(`${from}/`)) {
              return { ...buffer, path: to + buffer.path.slice(from.length) };
            }
            return buffer;
          }),
        );
        const fl = await api.listFiles(selectedId);
        if (projectRef.current !== selectedId) return;
        setFiles(fl);
        syncCodeRagAfterFileChange(selectedId);
        if (nextOpen && fl.includes(nextOpen) && !editorBinary && !editorDirty) {
          try {
            const raw = await api.readRawFile(selectedId, nextOpen);
            if (projectRef.current !== selectedId || filePathRef.current !== nextOpen || editorDirtyRef.current) return;
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
        if (projectRef.current === selectedId) setError(String(e));
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
        if (projectRef.current !== selectedId) return;
        setEditorBuffers((prev) => closeBuffer(prev, path));
        if (filePathRef.current === path) {
          const next = closeBuffer(editorBuffersRef.current, path);
          setEditorBuffers(next);
          const fallback = next[next.length - 1];
          if (fallback) {
            setFilePath(fallback.path);
            setEditorText(fallback.text);
            setSavedEditorText(fallback.savedText);
            setEditorBinary(fallback.binary);
          } else {
            setFilePath(null);
            setEditorText("");
            setSavedEditorText("");
            setEditorBinary(false);
          }
          setStaticPreviewBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
        const fl = await api.listFiles(selectedId);
        if (projectRef.current !== selectedId) return;
        setFiles(fl);
        syncCodeRagAfterFileChange(selectedId);
        setStatus(`Fichier supprimé : ${path}`);
      } catch (e) {
        if (projectRef.current === selectedId) setError(String(e));
      }
    },
    [selectedId, filePath, syncCodeRagAfterFileChange],
  );

  const saveEditor = useCallback(async () => {
    if (!selectedId || !filePath || editorBinary || !editorDirty) return;
    setError(null);
    try {
      await api.writeRawFile(selectedId, filePath, editorText);
      if (projectRef.current !== selectedId) return;
      if (filePathRef.current === filePath) setSavedEditorText(editorText);
      setEditorBuffers((prev) => markBufferSaved(prev, filePath, editorText));
      syncCodeRagAfterFileChange(selectedId);
      const ext = filePath.toLowerCase();
      if (filePathRef.current === filePath && (ext.endsWith(".html") || ext.endsWith(".htm"))) {
        const blob = new Blob([editorText], { type: "text/html" });
        setStaticPreviewBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      }
      setStatus(`Fichier enregistré : ${filePath}`);
    } catch (e) {
      if (projectRef.current === selectedId) setError(String(e));
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
  return {
    filesLoading, filesError, loadFiles, editorLoading, editorError, searchSummary,
    setFiles,
    setFilePath,
    setEditorText,
    setSavedEditorText,
    setEditorBinary,
    filePath,
    editorBinary,
    editorDirty,
    reloadOpenFileFromServer,
    filePathRef,
    editorDirtyRef,
    editorBinaryRef,
    editorQuickQuery,
    setEditorQuickQuery,
    files,
    openFile,
    onDeleteFile,
    handleStudioRename,
    editorBuffers,
    activateBuffer,
    closeEditorTab,
    saveEditor,
    setEditorMarkdownPreview,
    editorMarkdownPreview,
    editorText,
    onEditorChange,
    setEditorDiagnostics,
    editorSearchQuery,
    setEditorSearchQuery,
    onSearchProject,
    editorSearchBusy,
    editorSearchHits,
    editorDiagnostics,
    confirmDiscardDrafts
  };
}
