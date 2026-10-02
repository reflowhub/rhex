import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/**
 * Renders a markdown document from docs/ (API reference, admin help).
 * Server component: the markdown is read from disk by the page.
 */
export default function MarkdownContent({
  markdown,
  resolveLink,
}: {
  markdown: string;
  /** Maps a relative link (e.g. "send-label.md") to an app path; null leaves it as is */
  resolveLink?: (href: string) => string | null;
}) {
  const components: Components = {
    h1: ({ children }) => (
      <h1 className="text-3xl font-bold tracking-tight">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-12 border-t pt-8 text-xl font-semibold first:mt-0 first:border-t-0 first:pt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-8 text-lg font-semibold">{children}</h3>
    ),
    p: ({ children }) => <p className="mt-3 leading-relaxed">{children}</p>,
    ul: ({ children }) => (
      <ul className="mt-3 list-disc space-y-1 pl-6">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mt-3 list-decimal space-y-1 pl-6">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ href, children }) => {
      const internal = href && resolveLink ? resolveLink(href) : null;
      if (internal) {
        return (
          <Link
            href={internal}
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          className="text-primary underline underline-offset-4 hover:text-primary/80"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    hr: () => <hr className="my-8 border-border" />,
    code: ({ children, className }) => {
      const isBlock = className?.includes("language-");
      if (isBlock) {
        return (
          <code className="block text-sm">{children}</code>
        );
      }
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-zinc-100 dark:bg-zinc-800 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit [&_code]:rounded-none">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b bg-muted/50">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-semibold">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border-t px-3 py-2">{children}</td>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mt-3 border-l-4 border-muted pl-4 text-muted-foreground italic">
        {children}
      </blockquote>
    ),
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  );
}
