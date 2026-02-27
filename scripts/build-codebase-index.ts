/**
 * Build-time script that creates a snapshot of the codebase for the admin chat feature.
 * Run: npx tsx scripts/build-codebase-index.ts
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "data", "codebase-snapshot.json");

const INCLUDE_DIRS = ["app", "lib", "components", "scripts", "docs", "emails"];
const INCLUDE_ROOT_FILES = [
  "middleware.ts",
  "next.config.ts",
  "tailwind.config.ts",
  "package.json",
  "tsconfig.json",
  "components.json",
  "firestore.rules",
  "firestore.indexes.json",
];
const INCLUDE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".css",
]);
const EXCLUDE_PATTERNS = [
  "node_modules",
  ".next",
  ".env",
  ".d.ts",
  "firebase-credentials",
];
const MAX_FILE_SIZE = 100_000; // 100 KB per file

interface SnapshotFile {
  path: string;
  content: string;
  lines: number;
}

function shouldInclude(filePath: string): boolean {
  const relative = path.relative(ROOT, filePath);
  const ext = path.extname(filePath);

  if (EXCLUDE_PATTERNS.some((p) => relative.includes(p))) return false;
  if (!INCLUDE_EXTENSIONS.has(ext)) return false;

  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE_SIZE) return false;

  return true;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      results.push(...walkDir(fullPath));
    } else if (entry.isFile() && shouldInclude(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  const files: SnapshotFile[] = [];

  // Walk included directories
  for (const dir of INCLUDE_DIRS) {
    const dirPath = path.join(ROOT, dir);
    if (fs.existsSync(dirPath)) {
      for (const filePath of walkDir(dirPath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        files.push({
          path: path.relative(ROOT, filePath),
          content,
          lines: content.split("\n").length,
        });
      }
    }
  }

  // Include specific root files
  for (const file of INCLUDE_ROOT_FILES) {
    const filePath = path.join(ROOT, file);
    if (fs.existsSync(filePath) && shouldInclude(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      files.push({
        path: file,
        content,
        lines: content.split("\n").length,
      });
    }
  }

  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    totalLines,
    files,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(snapshot));

  const sizeKB = (Buffer.byteLength(JSON.stringify(snapshot)) / 1024).toFixed(0);
  console.log(
    `Codebase snapshot: ${files.length} files, ${totalLines.toLocaleString()} lines, ${sizeKB} KB`
  );
  console.log(`Written to: ${path.relative(ROOT, OUTPUT)}`);
}

main();
