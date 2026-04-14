import Editor from "@monaco-editor/react";

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

type CodeEditorProps = {
  path: string | null;
  value: string;
  onChange: (v: string) => void;
};

export function CodeEditor({ path, value, onChange }: CodeEditorProps) {
  const lang = languageFromPath(path);
  return (
    <div className="monaco-container">
      <Editor
        height="100%"
        theme="vs-dark"
        path={path ?? "untitled"}
        defaultLanguage={lang}
        language={lang}
        value={value}
        onChange={(v) => onChange(v ?? "")}
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
