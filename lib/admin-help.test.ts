import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { helpLinkHref, listHelpSlugs, readHelpPage } from "@/lib/admin-help";

const pagePaths = new Set(
  listHelpSlugs().map((slug) => `/admin/help${slug.length ? `/${slug.join("/")}` : ""}`)
);

describe("helpLinkHref", () => {
  it("maps relative .md links to help routes", () => {
    expect(helpLinkHref("trade-ins/index.md", "send-label.md")).toBe(
      "/admin/help/trade-ins/send-label"
    );
    expect(helpLinkHref("index.md", "trade-ins/index.md")).toBe("/admin/help/trade-ins");
    expect(helpLinkHref("trade-ins/cancel.md", "../index.md")).toBe("/admin/help");
    expect(helpLinkHref("trade-ins/cancel.md", "send-label.md#replace-a-label")).toBe(
      "/admin/help/trade-ins/send-label#replace-a-label"
    );
  });

  it("leaves other links alone", () => {
    expect(helpLinkHref("index.md", "https://auspost.com.au")).toBeNull();
    expect(helpLinkHref("index.md", "/admin/quotes")).toBeNull();
    expect(helpLinkHref("index.md", "../../README.md")).toBeNull();
  });
});

describe("readHelpPage", () => {
  it("reads pages and folder indexes", () => {
    expect(readHelpPage([])?.file).toBe("index.md");
    expect(readHelpPage(["trade-ins"])?.file).toBe("trade-ins/index.md");
    expect(readHelpPage(["trade-ins", "send-label"])?.title).toBe("Send a shipping label");
  });

  it("rejects missing pages and unsafe slugs", () => {
    expect(readHelpPage(["trade-ins", "nope"])).toBeNull();
    expect(readHelpPage(["..", "PLAN"])).toBeNull();
  });
});

describe("docs/admin-guide", () => {
  it("has no broken links between pages", () => {
    for (const slug of listHelpSlugs()) {
      const page = readHelpPage(slug)!;
      for (const [, href] of page.markdown.matchAll(/\]\(([^)]+)\)/g)) {
        const target = helpLinkHref(page.file, href);
        if (target === null) continue;
        expect(pagePaths, `${page.file} → ${href}`).toContain(target.split("#")[0]);
      }
    }
  });

  it("has a page for every help link in the admin screens", () => {
    const files = fs
      .readdirSync(path.join(process.cwd(), "app", "admin"), { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".tsx"));
    for (const file of files) {
      const source = fs.readFileSync(path.join(process.cwd(), "app", "admin", file), "utf-8");
      for (const [, page] of source.matchAll(/"(trade-ins(?:\/[a-z0-9-]+)*)"/g)) {
        expect(pagePaths, `${file} → ${page}`).toContain(`/admin/help/${page}`);
      }
    }
  });
});
