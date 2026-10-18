export type EditorBuffer = {
  path: string;
  text: string;
  savedText: string;
  binary: boolean;
};

export type SearchHit = {
  path: string;
  line: number;
  text: string;
};

export function bufferDirty(buffer: EditorBuffer): boolean {
  return !buffer.binary && buffer.text !== buffer.savedText;
}

export function upsertBuffer(list: EditorBuffer[], buffer: EditorBuffer): EditorBuffer[] {
  const index = list.findIndex((row) => row.path === buffer.path);
  if (index < 0) return [...list, buffer];
  const next = list.slice();
  next[index] = buffer;
  return next;
}

export function touchBufferText(list: EditorBuffer[], path: string | null, text: string): EditorBuffer[] {
  if (!path) return list;
  return list.map((row) => (row.path === path ? { ...row, text } : row));
}

export function markBufferSaved(list: EditorBuffer[], path: string, text: string): EditorBuffer[] {
  return list.map((row) => (row.path === path ? { ...row, savedText: text } : row));
}

export function closeBuffer(list: EditorBuffer[], path: string): EditorBuffer[] {
  return list.filter((row) => row.path !== path);
}

export function filterPaths(files: string[], query: string): string[] {
  const needle = query.trim().toLowerCase();
  const source = needle ? files.filter((file) => file.toLowerCase().includes(needle)) : files;
  return source.slice(0, 40);
}

export function searchTextFiles(
  entries: { path: string; text: string }[],
  query: string,
  limit = 40,
): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const lines = entry.text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].toLowerCase().includes(needle)) continue;
      hits.push({
        path: entry.path,
        line: index + 1,
        text: lines[index].trim().slice(0, 180),
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}
