import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

export type FileTreeNode =
  | { kind: "dir"; name: string; path: string; children: FileTreeNode[] }
  | { kind: "file"; name: string; path: string };

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function parentDir(rel: string): string {
  const i = rel.lastIndexOf("/");
  return i === -1 ? "" : rel.slice(0, i);
}

function buildFileTree(files: string[]): FileTreeNode[] {
  const root: FileTreeNode = { kind: "dir", name: "", path: "", children: [] };

  for (const raw of files) {
    const p = normalizePath(raw);
    if (!p) continue;
    const parts = p.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let cur: FileTreeNode = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        if (cur.kind !== "dir") break;
        cur.children.push({ kind: "file", name: part, path: p });
      } else {
        if (cur.kind !== "dir") break;
        const dirPath = parts.slice(0, i + 1).join("/");
        let nextDir: Extract<FileTreeNode, { kind: "dir" }> | undefined = cur.children.find(
          (c): c is Extract<FileTreeNode, { kind: "dir" }> => c.kind === "dir" && c.path === dirPath,
        );
        if (!nextDir) {
          nextDir = { kind: "dir", name: part, path: dirPath, children: [] };
          cur.children.push(nextDir);
        }
        cur = nextDir;
      }
    }
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    for (const n of nodes) {
      if (n.kind === "dir") sortNodes(n.children);
    }
  };
  sortNodes(root.children);
  return root.children;
}

type EditorFileTreeProps = {
  files: string[];
  activePath: string | null;
  onOpenFile: (path: string) => void | Promise<void>;
  onDeleteFile: (path: string) => void | Promise<void>;
  onRenamePath: (from: string, to: string) => Promise<void>;
};

export function EditorFileTree({ files, activePath, onOpenFile, onDeleteFile, onRenamePath }: EditorFileTreeProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dragOverDir, setDragOverDir] = useState<string | null>(null);
  const submittingRename = useRef(false);

  const toggleDir = useCallback((dirPath: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  }, []);

  const startRename = useCallback((path: string, currentName: string) => {
    setEditingPath(path);
    setEditValue(currentName);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingPath(null);
    setEditValue("");
  }, []);

  const commitRename = useCallback(
    async (nodePath: string) => {
      if (submittingRename.current) return;
      const name = editValue.trim();
      if (!name || name.includes("/") || name.includes("\\")) {
        cancelRename();
        return;
      }
      const parent = parentDir(nodePath);
      const to = parent ? `${parent}/${name}` : name;
      if (to === nodePath) {
        cancelRename();
        return;
      }
      submittingRename.current = true;
      try {
        await onRenamePath(nodePath, to);
      } finally {
        submittingRename.current = false;
        cancelRename();
      }
    },
    [editValue, onRenamePath, cancelRename],
  );

  const onDropOnDir = useCallback(
    async (targetDirPath: string, srcPath: string) => {
      const norm = normalizePath(srcPath);
      if (!norm || norm === targetDirPath) return;
      if (targetDirPath && (norm === targetDirPath || norm.startsWith(targetDirPath + "/"))) return;
      const looksLikeDir = files.some((f) => {
        const fp = normalizePath(f);
        return fp !== norm && fp.startsWith(`${norm}/`);
      });
      if (looksLikeDir && (targetDirPath === norm || targetDirPath.startsWith(`${norm}/`))) return;
      const base = norm.split("/").pop() ?? norm;
      const dest = targetDirPath ? `${targetDirPath}/${base}` : base;
      if (dest === norm) return;
      await onRenamePath(norm, dest);
    },
    [files, onRenamePath],
  );

  const renderNodes = (nodes: FileTreeNode[], depth: number): ReactNode => {
    return nodes.map((node) => {
      const pad = 0.35 + depth * 0.65;
      if (node.kind === "file") {
        const isActive = activePath === node.path;
        const isEditing = editingPath === node.path;
        return (
          <li
            key={`f:${node.path}`}
            className={`editor-file-tree-row editor-file-tree-row--file${isActive ? " is-active" : ""}`}
            style={{ paddingLeft: `${pad}rem` }}
            draggable={!isEditing}
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-akasha-studio-path", node.path);
              e.dataTransfer.setData("text/plain", node.path);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            {isEditing ? (
              <input
                className="editor-file-tree-rename-input"
                value={editValue}
                onChange={(ev) => setEditValue(ev.target.value)}
                onBlur={() => void commitRename(node.path)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    ev.preventDefault();
                    void commitRename(node.path);
                  }
                  if (ev.key === "Escape") cancelRename();
                }}
                autoFocus
              />
            ) : (
              <>
                <button type="button" className="editor-file-tree-label" onClick={() => void onOpenFile(node.path)}>
                  {node.name}
                </button>
                <span className="editor-file-tree-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title={`Renommer ${node.path}`}
                    onClick={() => startRename(node.path, node.name)}
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm file-list-delete"
                    data-testid="studio-delete-file"
                    title={`Supprimer ${node.path}`}
                    onClick={() => void onDeleteFile(node.path)}
                  >
                    Suppr.
                  </button>
                </span>
              </>
            )}
          </li>
        );
      }

      const collapsedHere = collapsed.has(node.path);
      const isEditing = editingPath === node.path;

      return (
        <li
          key={`d:${node.path || "root"}`}
          className={`editor-file-tree-dir${dragOverDir === node.path ? " is-drop-target" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            setDragOverDir(node.path);
          }}
          onDragLeave={(e) => {
            const related = e.relatedTarget as Node | null;
            if (related && e.currentTarget.contains(related)) return;
            setDragOverDir(null);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverDir(null);
            const src = e.dataTransfer.getData("application/x-akasha-studio-path");
            if (src) await onDropOnDir(node.path, src);
          }}
        >
          <div
            className="editor-file-tree-row editor-file-tree-row--dir"
            style={{ paddingLeft: `${pad}rem` }}
            draggable={!isEditing}
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData("application/x-akasha-studio-path", node.path);
              e.dataTransfer.setData("text/plain", node.path);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <button
              type="button"
              className="editor-file-tree-chevron"
              aria-expanded={!collapsedHere}
              title={collapsedHere ? "Développer" : "Replier"}
              onClick={() => toggleDir(node.path)}
            >
              {collapsedHere ? "▸" : "▾"}
            </button>
            {isEditing ? (
              <input
                className="editor-file-tree-rename-input"
                value={editValue}
                onChange={(ev) => setEditValue(ev.target.value)}
                onBlur={() => void commitRename(node.path)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    ev.preventDefault();
                    void commitRename(node.path);
                  }
                  if (ev.key === "Escape") cancelRename();
                }}
                autoFocus
              />
            ) : (
              <>
                <span className="editor-file-tree-dir-label">{node.name}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm editor-file-tree-rename-btn"
                  title={`Renommer le dossier ${node.path}`}
                  onClick={() => startRename(node.path, node.name)}
                >
                  Renommer
                </button>
              </>
            )}
          </div>
          {!collapsedHere && node.children.length > 0 ? (
            <ul className="editor-file-tree-nested">{renderNodes(node.children, depth + 1)}</ul>
          ) : null}
        </li>
      );
    });
  };

  return (
    <div className="editor-file-tree-wrap" onDragEnd={() => setDragOverDir(null)}>
      <div
        className={`editor-file-tree-root-drop${dragOverDir === "" ? " is-drop-target" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOverDir("");
        }}
        onDragLeave={(e) => {
          const related = e.relatedTarget as Node | null;
          if (related && e.currentTarget.contains(related)) return;
          setDragOverDir(null);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOverDir(null);
          const src = e.dataTransfer.getData("application/x-akasha-studio-path");
          if (src) await onDropOnDir("", src);
        }}
      >
        Déposer ici pour placer à la racine du projet
      </div>
      <ul className="editor-file-tree file-list">{renderNodes(tree, 0)}</ul>
    </div>
  );
}
