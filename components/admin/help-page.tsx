import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import MarkdownContent from "@/components/markdown-content";
import { helpLinkHref, parentHelpPage, readHelpPage } from "@/lib/admin-help";

/** An admin help page from docs/admin-guide (server component). */
export default function HelpPage({ slug }: { slug: string[] }) {
  const page = readHelpPage(slug);
  if (!page) notFound();
  const parent = parentHelpPage(slug);

  return (
    <div className="max-w-3xl pb-20">
      {parent && (
        <Link
          href={parent.href}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {parent.title}
        </Link>
      )}
      <div className="text-sm leading-relaxed text-foreground/90">
        <MarkdownContent
          markdown={page.markdown}
          resolveLink={(href) => helpLinkHref(page.file, href)}
        />
      </div>
    </div>
  );
}
