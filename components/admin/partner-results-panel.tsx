"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PartnerResult {
  id: string;
  status: "pending" | "sent" | "failed";
  body: { approvedQuotePrice: number; acceptGrading: string; accepted: boolean };
  sandbox: boolean;
  transition: { from: string; to: string } | null;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  lastResponse: string | null;
  nextAttemptAt: string | null;
  createdAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_BADGE: Record<PartnerResult["status"], string> = {
  pending: "border-amber-300 text-amber-700",
  sent: "border-transparent bg-green-600 text-white hover:bg-green-600/80",
  failed: "border-transparent bg-destructive text-white hover:bg-destructive/80",
};

/**
 * Mode C: the final results sent to the partner (e.g. OPPO), with each
 * delivery's status and a "Retry now" for pending or failed ones.
 * `refreshKey` reloads the list when the quote changes.
 */
export default function PartnerResultsPanel({
  quoteId,
  partnerName,
  refreshKey,
}: {
  quoteId: string;
  partnerName: string;
  refreshKey: string;
}) {
  const [results, setResults] = useState<PartnerResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/quotes/${quoteId}/partner-results`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setResults(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const retry = async (notificationId: string) => {
    setRetrying(notificationId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/quotes/${quoteId}/partner-results/${notificationId}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Retry failed");
      load();
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Result sent to {partnerName}</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={load} aria-label="Reload">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        The final outcome goes to {partnerName} once: when the trade-in is
        approved, or when it ends without going ahead. On{" "}
        <span className="font-medium">accepted</span>, {partnerName} refunds the
        customer. Failed deliveries are retried automatically for about two days.
      </p>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {results === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing sent yet. A result is queued when the trade-in is approved or
          returned.
        </p>
      ) : (
        <ul className="grid gap-3">
          {results.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={STATUS_BADGE[r.status]}>
                    {r.status === "pending" ? "Pending" : r.status === "sent" ? "Delivered" : "Failed"}
                  </Badge>
                  {r.sandbox && (
                    <Badge variant="outline" className="text-xs">
                      Sandbox
                    </Badge>
                  )}
                  <span className="font-medium">
                    {r.body.accepted ? "Accepted" : "Not accepted"} · $
                    {r.body.approvedQuotePrice.toFixed(2)} · Grade {r.body.acceptGrading}
                  </span>
                </div>
                {r.status !== "sent" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retry(r.id)}
                    disabled={retrying !== null}
                  >
                    {retrying === r.id && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    Retry now
                  </Button>
                )}
              </div>
              <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
                <div>
                  Queued {formatDate(r.createdAt)}
                  {r.transition && ` (${r.transition.from} → ${r.transition.to})`}
                  {" · "}
                  {r.attempts} attempt{r.attempts === 1 ? "" : "s"}
                  {r.status === "sent" && ` · delivered ${formatDate(r.sentAt)}`}
                  {r.status === "pending" &&
                    r.attempts > 0 &&
                    ` · next try ${formatDate(r.nextAttemptAt)}`}
                </div>
                {r.lastError && r.status !== "sent" && (
                  <div className="text-destructive">
                    Last error: {r.lastError}
                    {r.lastResponse && ` — ${r.lastResponse}`}
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
