import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import { AsyncState } from "./asyncState";
import { Button } from "./components/ui/button";
import { normalizeHttpError } from "./api";

type LspRange = { start: { line: number; character: number }; end: { line: number; character: number } };
type LspResult = { result?: { status?: string; diagnostics?: { range: LspRange; message: string; severity?: number }[]; locations?: { path: string; range: LspRange }[]; plan_id?: string; files?: { path: string; before: string; after: string; edit_count: number }[] }; status?: string; reason?: string };

export function languageFromPath(path: string | null): string {
  if (!path) return "plaintext";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    rs: "rust",
    py: "python",
    go: "go",
    toml: "ini",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    ps1: "powershell",
    vue: "html",
    xml: "xml",
    svg: "xml",
  };
  return map[ext] ?? "plaintext";
}

type EditorMarker = {
  startLineNumber: number;
  message: string;
};

type CodeEditorProps = {
  projectId?: string | null;
  hasDirtyBuffers?: boolean;
  onOpenLocation?: (path: string) => Promise<void>;
  onFilesApplied?: (paths: string[]) => Promise<void>;
  path: string | null;
  value: string;
  onChange: (v: string) => void;
  onValidate?: (markers: EditorMarker[]) => void;
};

export function CodeEditor({ path, value, onChange, onValidate, projectId, hasDirtyBuffers, onOpenLocation, onFilesApplied }: CodeEditorProps) {
  const lang = languageFromPath(path);
  const [binding, setBinding] = useState<{ editor: Monaco.editor.IStandaloneCodeEditor; monaco: typeof Monaco } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [lspStatus, setLspStatus] = useState("Serveur désactivé. Les diagnostics Monaco locaux restent disponibles.");
  const [newName, setNewName] = useState("");
  const [plan, setPlan] = useState<LspResult["result"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const latest = useRef({ path, projectId, onOpenLocation, onFilesApplied, value });
  latest.current = { path, projectId, onOpenLocation, onFilesApplied, value };
  const pendingReveal = useRef<{ path: string; line: number; column: number } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const modelUri = projectId && path ? `studio://${projectId}/${path.split("/").map(encodeURIComponent).join("/")}` : path ?? "untitled";
  const endpoint = `/api/studio/projects/${encodeURIComponent(projectId ?? "")}/lsp`;
  const query = async (action: string, position?: { line: number; character: number }, signal?: AbortSignal, text = value): Promise<LspResult> => {
    const response = await fetch(`${endpoint}/query`, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, path, text, ...(position ? { position } : {}), ...(action === "rename" ? { new_name: newName } : {}) }) });
    if (!response.ok) throw await normalizeHttpError("POST", `${endpoint}/query`, response);
    return response.json() as Promise<LspResult>;
  };
  useEffect(() => { setPlan(null); }, [path, projectId]);
  useEffect(() => {
    if (!binding) return;
    const listener = binding.editor.onDidChangeCursorPosition(event => setCursor({ line: event.position.lineNumber, column: event.position.column }));
    return () => listener.dispose();
  }, [binding]);
  useEffect(() => {
    if (!binding) return;
    let frame = 0, attempts = 0;
    const reveal = () => {
      const pending = pendingReveal.current;
      if (!pending || pending.path !== path) return;
      if (binding.editor.getModel()?.uri.toString() === binding.monaco.Uri.parse(modelUri).toString()) {
        binding.editor.setPosition({ lineNumber: pending.line, column: pending.column }); binding.editor.revealLineInCenter(pending.line); binding.editor.focus(); pendingReveal.current = null;
      } else if (++attempts < 10) frame = requestAnimationFrame(reveal);
    };
    frame = requestAnimationFrame(reveal);
    return () => cancelAnimationFrame(frame);
  }, [path, binding, value, modelUri]);
  useEffect(() => {
    if (!binding || !enabled || !projectId || !path) return;
    const { editor, monaco } = binding;
    const model = editor.getModel(); if (!model) return;
    const currentUri = model.uri.toString();
    const uri = (target: string) => monaco.Uri.parse(`studio://${projectId}/${target.split("/").map(encodeURIComponent).join("/")}`);
    const range = (value: LspRange) => new monaco.Range(value.start.line + 1, value.start.character + 1, value.end.line + 1, value.end.character + 1);
    const resolveLocations = async (target: Monaco.editor.ITextModel, position: Monaco.Position, token: Monaco.CancellationToken, action: string) => {
      if (target.uri.toString() !== currentUri) return [];
      const controller = new AbortController(); const cancel = token.onCancellationRequested(() => controller.abort());
      const version = target.getVersionId();
      try {
        const result = await query(action, { line: position.lineNumber - 1, character: position.column - 1 }, controller.signal, target.getValue());
        if (token.isCancellationRequested || version !== target.getVersionId()) return [];
        return (result.result?.locations ?? []).map(item => ({ uri: uri(item.path), range: range(item.range) }));
      } catch (reason) { if (!controller.signal.aborted && mounted.current) setLspStatus(String(reason)); return []; } finally { cancel.dispose(); }
    };
    const definitions = monaco.languages.registerDefinitionProvider(lang, { provideDefinition: (target, position, token) => resolveLocations(target, position, token, "definition") });
    const references = monaco.languages.registerReferenceProvider(lang, { provideReferences: (target, position, _context, token) => resolveLocations(target, position, token, "references") });
    const opener = monaco.editor.registerEditorOpener({ openCodeEditor: async (_source, resource, selection) => {
      if (resource.scheme !== "studio" || resource.authority !== projectId || !latest.current.onOpenLocation) return false;
      const target = resource.path.replace(/^\//, "").split("/").map(decodeURIComponent).join("/");
      const line = selection && "startLineNumber" in selection ? selection.startLineNumber : selection?.lineNumber ?? 1;
      const column = selection && "startColumn" in selection ? selection.startColumn : selection?.column ?? 1;
      pendingReveal.current = { path: target, line, column };
      await latest.current.onOpenLocation(target); return true;
    } });
    return () => { definitions.dispose(); references.dispose(); opener.dispose(); monaco.editor.setModelMarkers(model, "akasha-lsp", []); };
    // Provider callbacks read the model text; value updates do not re-register global providers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding, enabled, projectId, path, lang]);
  useEffect(() => {
    if (!binding || !enabled || !projectId || !path) return;
    const controller = new AbortController(); const requested = value;
    const model = binding.editor.getModel(); if (!model) return;
    const timer = setTimeout(() => {
      setLspStatus("Analyse du serveur LSP…");
      void query("diagnostics", undefined, controller.signal).then(response => {
        if (controller.signal.aborted || latest.current.path !== path || latest.current.value !== requested) return;
        const result = response.result ?? response;
        if (result.status !== "ready") { binding.monaco.editor.setModelMarkers(model, "akasha-lsp", []); setLspStatus("Diagnostics LSP en attente : le serveur peut encore indexer. Désactivez puis réactivez LSP pour actualiser."); return; }
        const diagnostics = response.result?.diagnostics ?? [];
        binding.monaco.editor.setModelMarkers(model, "akasha-lsp", diagnostics.map(item => ({
          startLineNumber: item.range.start.line + 1, startColumn: item.range.start.character + 1,
          endLineNumber: item.range.end.line + 1, endColumn: item.range.end.character + 1,
          message: item.message, source: "Akasha LSP", severity: item.severity === 1 ? 8 : item.severity === 2 ? 4 : 2,
        })));
        setLspStatus(`${diagnostics.length} diagnostic(s) serveur · F12 : définition · Maj+F12 : références.`);
      }).catch(reason => { if (!controller.signal.aborted) { binding.monaco.editor.setModelMarkers(model, "akasha-lsp", []); setLspStatus(`LSP indisponible : ${String(reason)}`); } });
    }, 700);
    return () => { controller.abort(); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding, enabled, projectId, path, value]);
  const prepareRename = async () => {
    if (hasDirtyBuffers) { setLspStatus("Enregistrez les brouillons avant de préparer un renommage."); return; }
    setBusy(true); setPlan(null);
    try { const response = await query("rename", { line: cursor.line - 1, character: cursor.column - 1 }); if (mounted.current && latest.current.path === path) { setPlan(response.result); setLspStatus("Plan préparé. Consultez les changements avant application."); } }
    catch (reason) { if (mounted.current) setLspStatus(String(reason)); } finally { if (mounted.current) setBusy(false); }
  };
  const applyRename = async () => {
    if (!plan?.plan_id || hasDirtyBuffers) return;
    setBusy(true);
    try {
      const url = `${endpoint}/rename/${encodeURIComponent(plan.plan_id)}/apply`;
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw await normalizeHttpError("POST", url, response);
      const result = await response.json() as { files: string[] };
      await onFilesApplied?.(result.files);
      if (mounted.current) { setPlan(null); setEnabled(false); setLspStatus("Renommage appliqué. Réactivez LSP pour actualiser les diagnostics."); }
    } catch (reason) { if (mounted.current) setLspStatus(String(reason)); } finally { if (mounted.current) setBusy(false); }
  };
  return (
    <div className="monaco-container" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {projectId && path ? <details className="editor-semantic-tools">
        <summary>Analyse sémantique LSP</summary>
        <label><input type="checkbox" checked={enabled} disabled={busy} onChange={event => { setEnabled(event.target.checked); if (!event.target.checked) setLspStatus("Serveur désactivé pour cette vue. Les sessions inactives expirent après 15 minutes."); }} /> Activer le serveur pour ce projet</label>
        <p className="hint" role="status">{lspStatus}</p>
        <p className="hint">Serveur préinstallé et autorisé requis : TypeScript/JavaScript, Rust ou Python. Curseur : {cursor.line}:{cursor.column}.</p>
        <form onSubmit={event => { event.preventDefault(); void prepareRename(); }}>
          <label>Nouveau nom <input value={newName} onChange={event => setNewName(event.target.value)} maxLength={256} required /></label>
          <Button size="sm" variant="secondary" disabled={!enabled || busy || hasDirtyBuffers || !newName.trim()}>Préparer le renommage</Button>
        </form>
        {plan ? <div>{plan.files?.map(file => <details key={file.path}><summary>{file.path} · {file.edit_count} modification(s)</summary><h4>Avant</h4><pre className="build-pre">{file.before}</pre><h4>Après</h4><pre className="build-pre">{file.after}</pre></details>)}<Button size="sm" disabled={busy || hasDirtyBuffers || !plan.plan_id} onClick={() => void applyRename()}>Appliquer ce plan</Button></div> : null}
      </details> : null}
      <div style={{ flex: 1, minHeight: 0 }}>
      <Editor
        loading={<AsyncState kind="loading" title="Chargement de l’éditeur…" />}
        height="100%"
        theme="vs-dark"
        path={modelUri}
        defaultLanguage={lang}
        language={lang}
        value={value}
        onMount={(editor, monaco) => setBinding({ editor, monaco })}
        onChange={(v) => onChange(v ?? "")}
        onValidate={(markers) =>
          onValidate?.(
            markers.map((marker) => ({
              startLineNumber: marker.startLineNumber,
              message: marker.message,
            })),
          )
        }
        options={{
          readOnly: busy,
          minimap: { enabled: true },
          wordWrap: "on",
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          automaticLayout: true,
          tabSize: 2,
        }}
      />
      </div>
    </div>
  );
}
