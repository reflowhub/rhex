import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Link from an admin screen to its help page (docs/admin-guide), e.g.
 * page="trade-ins/send-label". Opens in a new tab so work in progress,
 * such as an open dialog, isn't lost.
 */
export default function HelpLink({
  page,
  label = "Help",
  className,
}: {
  page: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`/admin/help/${page}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-xs font-normal text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      <CircleHelp className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
