import Editor from "@monaco-editor/react";
import { AsyncState } from "./asyncState";

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
  path: string | null;
  value: string;
  onChange: (v: string) => void;
  onValidate?: (markers: EditorMarker[]) => void;
};

export function CodeEditor({ path, value, onChange, onValidate }: CodeEditorProps) {
  const lang = languageFromPath(path);
  return (
    <div className="monaco-container">
      <Editor
        loading={<AsyncState kind="loading" title="Chargement de l’éditeur…" />}
        height="100%"
        theme="vs-dark"
        path={path ?? "untitled"}
        defaultLanguage={lang}
        language={lang}
        value={value}
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
  );
}
