"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ScanLine, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import HelpLink from "@/components/admin/help-link";
import { QUOTE_STATUS_LABELS, isQuoteStatus } from "@/lib/quote-status";
import { REFUND_URGENT_DAYS } from "@/lib/label-deadlines";

// ---------------------------------------------------------------------------
// Types (GET /api/admin/trade-ins/queues)
// ---------------------------------------------------------------------------

interface QuoteRow {
  id: string;
  tradeInRef: string | null;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  device: string;
  trackingNumber: string | null;
  acceptedAt: string | null;
  labelSentAt: string | null;
  expectedByAt: string | null;
  partnerMode: string | null;
  partnerName: string | null;
}

interface AwaitingRow extends QuoteRow {
  waitingDays: number | null;
  /** Mode C: when the label becomes overdue (end of the next business day) */
  labelDueAt: string | null;
  labelOverdue: boolean;
  /** Mode C: who makes the label (the partner, or Reflow) */
  labelBy: "reflow" | "partner";
}

interface ReturnRow extends QuoteRow {
  returningDays: number | null;
  returnLabelBy: "reflow" | "partner";
  /** The partner's return label has been uploaded */
  returnLabelReady: boolean;
}

interface OverdueRow extends QuoteRow {
  daysOverdue: number;
}

interface RefundRow {
  labelId: string;
  quoteId: string;
  tradeInRef: string | null;
  customerName: string | null;
  trackingNumber: string;
  costAUD: number | null;
  sentAt: string | null;
  ageDays: number;
  urgent: boolean;
  reason: string;
}

interface Queues {
  awaitingLabel: AwaitingRow[];
  overdue: OverdueRow[];
  toReturn: ReturnRow[];
  labelsToRefund: RefundRow[];
}

type Tab = "awaiting" | "overdue" | "returns" | "refunds";

/** Help page for each queue (docs/admin-guide/trade-ins) */
const TAB_HELP: Record<Tab, string> = {
  awaiting: "trade-ins/send-label",
  overdue: "trade-ins/overdue-parcel",
  returns: "trade-ins/return-device",
  refunds: "trade-ins/refund-labels",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The business day a Mode C label is due, e.g. "Tue 6 Oct" (Sydney time). */
function formatDueDay(dueAt: string): string {
  // dueAt is the midnight that ends the due day
  return new Date(new Date(dueAt).getTime() - 1).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Sydney",
  });
}

function days(n: number | null): string {
  if (n === null) return "—";
  return `${n} day${n === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TradeInOpsPage() {
  const router = useRouter();
  const [queues, setQueues] = useState<Queues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("awaiting");

  // Open a queue directly from a link (/admin/trade-ins?tab=overdue)
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (
      requested === "awaiting" ||
      requested === "overdue" ||
      requested === "returns" ||
      requested === "refunds"
    ) {
      setTab(requested);
    }
  }, []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/trade-ins/queues")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load queues");
        setQueues(data);
        setSelected(new Set());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const cancelSelected = async () => {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Cancel ${selected.size} quote${selected.size === 1 ? "" : "s"} as not genuine? This can't be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/trade-ins/cancel-not-genuine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error ?? "Failed to cancel quotes");
      } else {
        setNotice(
          `Cancelled ${data.cancelled.length}.` +
            (data.failed.length
              ? ` ${data.failed.length} failed: ${data.failed
                  .map((f: { id: string; error: string }) => `${f.id.slice(0, 8)} (${f.error})`)
                  .join(", ")}`
              : "")
        );
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const resolveRefund = async (
    labelId: string,
    refundState: "refunded" | "not_refundable"
  ) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/trade-ins/labels/${labelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundState }),
      });
      const data = await res.json();
      if (!res.ok) setNotice(data.error ?? "Failed to update label");
      else load();
    } finally {
      setBusy(false);
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "awaiting", label: "Awaiting label", count: queues?.awaitingLabel.length ?? 0 },
    { key: "overdue", label: "Overdue", count: queues?.overdue.length ?? 0 },
    { key: "returns", label: "To return", count: queues?.toReturn.length ?? 0 },
    { key: "refunds", label: "Labels to refund", count: queues?.labelsToRefund.length ?? 0 },
  ];

  const openQuote = (id: string) => router.push(`/admin/quotes/${id}`);
  const awaitingOverdue = queues?.awaitingLabel.filter((q) => q.labelOverdue).length ?? 0;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trade-in Ops</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Labels to send, parcels running late, devices to return and
            labels to refund.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpLink page={TAB_HELP[tab]} className="mr-2" />
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/admin/trade-ins/receive">
              <ScanLine className="mr-2 h-4 w-4" />
              Receive Parcel
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {t.label} ({t.count})
            {t.key === "awaiting" && awaitingOverdue > 0 && (
              <span className={cn("ml-1", tab !== t.key && "text-destructive")}>
                · {awaitingOverdue} overdue
              </span>
            )}
          </button>
        ))}
      </div>

      {notice && <p className="mt-4 text-sm text-muted-foreground">{notice}</p>}

      <div className="mt-6 rounded-lg border border-border bg-card">
        {loading && !queues ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-20 text-center text-sm text-destructive">{error}</div>
        ) : !queues ? null : tab === "awaiting" ? (
          queues.awaitingLabel.length === 0 ? (
            <Empty text="No accepted quotes are waiting for a label." />
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Overdue partner labels first, then oldest first. Create the
                  label in the AusPost portal, then upload it on the quote. For
                  rows marked as the partner&apos;s label, chase the partner
                  if it&apos;s overdue.
                  {awaitingOverdue > 0 && (
                    <span className="font-medium text-destructive">
                      {" "}{awaitingOverdue} partner label{awaitingOverdue === 1 ? " is" : "s are"} overdue.
                    </span>
                  )}{" "}
                  <HelpLink page="trade-ins/clear-not-genuine" label="Spotting fake acceptances" />
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy || selected.size === 0}
                  onClick={cancelSelected}
                >
                  Cancel as not genuine ({selected.size})
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Accepted</TableHead>
                    <TableHead>Waiting</TableHead>
                    <TableHead>Label due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queues.awaitingLabel.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer" onClick={() => openQuote(q.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${q.tradeInRef ?? q.id}`}
                          checked={selected.has(q.id)}
                          onChange={() => toggle(q.id)}
                          className="h-4 w-4 rounded border-border"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {q.tradeInRef ?? q.id.slice(0, 8)}
                        {q.partnerMode === "C" && (
                          <Badge variant="outline" className="ml-2 font-sans">
                            {q.partnerName ?? "Partner"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{q.customerName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{q.customerEmail}</div>
                      </TableCell>
                      <TableCell>{q.device}</TableCell>
                      <TableCell>{formatDate(q.acceptedAt)}</TableCell>
                      <TableCell
                        className={cn((q.waitingDays ?? 0) >= 2 && "font-medium text-amber-700")}
                      >
                        {days(q.waitingDays)}
                      </TableCell>
                      <TableCell
                        className={cn(q.labelOverdue && "font-medium text-destructive")}
                      >
                        {q.labelDueAt
                          ? `${q.labelOverdue ? "Overdue · " : ""}${formatDueDay(q.labelDueAt)}`
                          : "—"}
                        {q.labelBy === "partner" && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {q.partnerName ?? "Partner"}&apos;s label
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )
        ) : tab === "overdue" ? (
          queues.overdue.length === 0 ? (
            <Empty text="No parcels are overdue." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Expected by</TableHead>
                  <TableHead>Overdue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.overdue.map((q) => (
                  <TableRow key={q.id} className="cursor-pointer" onClick={() => openQuote(q.id)}>
                    <TableCell className="font-mono text-xs">
                      {q.tradeInRef ?? q.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{q.customerName ?? "—"}</TableCell>
                    <TableCell>{q.device}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {isQuoteStatus(q.status) ? QUOTE_STATUS_LABELS[q.status] : q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{q.trackingNumber}</TableCell>
                    <TableCell>{formatDate(q.expectedByAt)}</TableCell>
                    <TableCell className="font-medium text-destructive">
                      {days(q.daysOverdue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : tab === "returns" ? (
          queues.toReturn.length === 0 ? (
            <Empty text="No devices are waiting to be returned." />
          ) : (
            <>
              <p className="border-b px-4 py-3 text-sm text-muted-foreground">
                Post each device back to the customer, then mark it returned on
                the quote. Where the partner makes the return label, wait for
                it and upload it on the quote first.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Returning for</TableHead>
                    <TableHead>Return label</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queues.toReturn.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer" onClick={() => openQuote(q.id)}>
                      <TableCell className="font-mono text-xs">
                        {q.tradeInRef ?? q.id.slice(0, 8)}
                        {q.partnerMode === "C" && (
                          <Badge variant="outline" className="ml-2 font-sans">
                            {q.partnerName ?? "Partner"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{q.customerName ?? "—"}</TableCell>
                      <TableCell>{q.device}</TableCell>
                      <TableCell>{days(q.returningDays)}</TableCell>
                      <TableCell
                        className={cn(
                          q.returnLabelBy === "partner" &&
                            !q.returnLabelReady &&
                            "font-medium text-amber-700"
                        )}
                      >
                        {q.returnLabelBy === "reflow"
                          ? "Reflow makes it"
                          : q.returnLabelReady
                            ? `${q.partnerName ?? "Partner"}'s label ready`
                            : `Waiting for ${q.partnerName ?? "partner"}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )
        ) : queues.labelsToRefund.length === 0 ? (
          <Empty text="No labels are waiting for a refund." />
        ) : (
          <>
            <p className="border-b px-4 py-3 text-sm text-muted-foreground">
              Check tracking shows no scans, then request the refund in the
              AusPost portal. Flagged urgent from day {REFUND_URGENT_DAYS};
              AusPost&apos;s deadline is day 90.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.labelsToRefund.map((l) => (
                  <TableRow key={l.labelId}>
                    <TableCell className="font-mono text-xs">{l.trackingNumber}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/quotes/${l.quoteId}`}
                        className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                      >
                        {l.tradeInRef ?? l.quoteId.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>{l.reason}</TableCell>
                    <TableCell>{formatDate(l.sentAt)}</TableCell>
                    <TableCell>
                      {days(l.ageDays)}
                      {l.urgent && (
                        <Badge variant="destructive" className="ml-2">
                          Urgent
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.costAUD != null ? `$${l.costAUD.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => resolveRefund(l.labelId, "refunded")}
                        >
                          Mark refunded
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => resolveRefund(l.labelId, "not_refundable")}
                        >
                          Was used
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-20 text-center text-sm text-muted-foreground">{text}</div>;
}
