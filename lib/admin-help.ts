import fs from "fs";
import path from "path";

/**
 * Admin help pages: markdown in docs/admin-guide, served at /admin/help.
 * "trade-ins/send-label" → docs/admin-guide/trade-ins/send-label.md, and a
 * folder's index.md is served at the folder's path. Server only.
 */

const HELP_ROOT = path.join(process.cwd(), "docs", "admin-guide");
const SEGMENT = /^[a-z0-9-]+$/;

export const HELP_BASE_PATH = "/admin/help";

export interface HelpPage {
  slug: string[];
  /** Path of the file inside docs/admin-guide, e.g. "trade-ins/index.md" */
  file: string;
  title: string;
  markdown: string;
}

/** Every page's slug, for static generation ([] is the help home). */
export function listHelpSlugs(dir: string[] = []): string[][] {
  const slugs: string[][] = [];
  for (const entry of fs.readdirSync(path.join(HELP_ROOT, ...dir), { withFileTypes: true })) {
    if (entry.isDirectory() && SEGMENT.test(entry.name)) {
      slugs.push(...listHelpSlugs([...dir, entry.name]));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const name = entry.name.slice(0, -3);
      if (name === "index") slugs.push(dir);
      else if (SEGMENT.test(name)) slugs.push([...dir, name]);
    }
  }
  return slugs;
}

export function readHelpPage(slug: string[]): HelpPage | null {
  if (!slug.every((s) => SEGMENT.test(s))) return null;
  const candidates = [
    slug.length ? `${slug.join("/")}.md` : null,
    [...slug, "index.md"].join("/"),
  ].filter((f): f is string => f !== null);

  for (const file of candidates) {
    const full = path.join(HELP_ROOT, file);
    if (!fs.existsSync(full)) continue;
    const markdown = fs.readFileSync(full, "utf-8");
    const title = markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? "Help";
    return { slug, file, title, markdown };
  }
  return null;
}

/**
 * App path for a relative .md link in `fromFile`, e.g. "send-label.md" in
 * "trade-ins/index.md" → "/admin/help/trade-ins/send-label". Null for other
 * links, which open as normal.
 */
export function helpLinkHref(fromFile: string, href: string): string | null {
  const [target, hash] = href.split("#");
  if (!target.endsWith(".md") || /^[a-z]+:/i.test(target) || target.startsWith("/")) {
    return null;
  }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), target));
  if (resolved.startsWith("..")) return null;
  const page = resolved.slice(0, -3).replace(/(^|\/)index$/, "");
  return `${HELP_BASE_PATH}${page ? `/${page}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Link to the page above this one, or null on the help home. */
export function parentHelpPage(slug: string[]): { href: string; title: string } | null {
  if (slug.length === 0) return null;
  const parentSlug = slug.slice(0, -1);
  const parent = readHelpPage(parentSlug);
  return {
    href: `${HELP_BASE_PATH}${parentSlug.length ? `/${parentSlug.join("/")}` : ""}`,
    title: parent?.title ?? "Help",
  };
}
