import fs from "fs";
import path from "path";

interface CodebaseFile {
  path: string;
  content: string;
  lines: number;
}

interface CodebaseSnapshot {
  generatedAt: string;
  totalFiles: number;
  totalLines: number;
  files: CodebaseFile[];
}

// Load snapshot lazily on first use (server-side only)
let _snapshot: CodebaseSnapshot | null = null;

function getSnapshot(): CodebaseSnapshot {
  if (!_snapshot) {
    const filePath = path.join(process.cwd(), "data", "codebase-snapshot.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    _snapshot = JSON.parse(raw) as CodebaseSnapshot;
  }
  return _snapshot;
}

export function getSnapshotMeta() {
  const s = getSnapshot();
  return {
    generatedAt: s.generatedAt,
    totalFiles: s.totalFiles,
    totalLines: s.totalLines,
  };
}

export function listFiles(directory?: string): string[] {
  const s = getSnapshot();
  let paths = s.files.map((f) => f.path);
  if (directory) {
    const prefix = directory.endsWith("/") ? directory : directory + "/";
    paths = paths.filter((p) => p.startsWith(prefix));
  }
  return paths.sort();
}

export function readFile(
  filePath: string
): { content: string; lines: number } | null {
  const s = getSnapshot();
  const file = s.files.find((f) => f.path === filePath);
  if (!file) return null;
  return { content: file.content, lines: file.lines };
}

export function searchCode(
  query: string
): Array<{ path: string; matches: string[] }> {
  const s = getSnapshot();
  const queryLower = query.toLowerCase();
  const results: Array<{ path: string; matches: string[] }> = [];

  for (const file of s.files) {
    const lines = file.content.split("\n");
    const matchingLines = lines
      .map((line, i) => ({ line, num: i + 1 }))
      .filter(({ line }) => line.toLowerCase().includes(queryLower))
      .map(({ line, num }) => `${num}: ${line.trimStart()}`);

    if (matchingLines.length > 0) {
      results.push({
        path: file.path,
        matches: matchingLines.slice(0, 10),
      });
    }
  }

  return results.slice(0, 20);
}
