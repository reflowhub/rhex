import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import fs from "fs";
import path from "path";
import MarkdownContent from "@/components/markdown-content";

export const metadata: Metadata = {
  title: "API Reference | rhex",
  description:
    "RHEX Trade-In API reference documentation for partner integration.",
};

export default function ApiDocsPage() {
  const mdPath = path.join(process.cwd(), "docs", "API-REFERENCE.md");
  const markdown = fs.readFileSync(mdPath, "utf-8");

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20">
      <div className="flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-rhex.svg"
            alt="rhex"
            width={28}
            height={28}
            className="h-7 w-7"
          />
          <span className="text-xl font-bold tracking-tight">rhex</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="text-sm leading-relaxed text-foreground/90">
        <MarkdownContent markdown={markdown} />
      </div>
    </div>
  );
}
