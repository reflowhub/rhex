"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { usePartner } from "@/lib/partner-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Smartphone,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useFX } from "@/lib/use-fx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteDetail {
  id: string;
  type: "quote";
  deviceId: string;
  deviceMake: string;
  deviceModel: string;
  deviceStorage: string;
  grade: string;
  quotePriceNZD: number;
  publicPriceNZD: number | null;
  displayCurrency: string;
  status: string;
  partnerMode: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  inspectionGrade: string | null;
  revisedPriceNZD: number | null;
  createdAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  "quoted",
  "accepted",
  "shipped",
  "received",
  "inspected",
  "paid",
] as const;

const STATUS_LABELS: Record<string, string> = {
  quoted: "Quoted",
  accepted: "Accepted",
  shipped: "Shipped",
  received: "Received",
  inspected: "Inspected",
  paid: "Paid",
  cancelled: "Cancelled",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeProps(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
} {
  switch (status) {
    case "quoted":
      return { variant: "default" };
    case "accepted":
      return { variant: "secondary" };
    case "shipped":
      return { variant: "outline" };
    case "received":
      return { variant: "secondary" };
    case "inspected":
      return { variant: "default" };
    case "paid":
      return {
        variant: "default",
        className:
          "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80",
      };
    case "cancelled":
      return { variant: "destructive" };
    default:
      return { variant: "outline" };
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `$${value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { partner, loading: partnerLoading } = usePartner();
  const { formatPrice: fxFormatPrice } = useFX();

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/partner/quotes/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        // If it's a bulk quote, redirect to the estimate detail page
        if (data.type === "bulkQuote") {
          router.replace(`/partner/estimate/${id}`);
          return;
        }
        setQuote(data);
      })
      .catch(() => setError("Quote not found"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (partnerLoading || !partner) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="py-16 text-center">
        <p className="text-destructive">{error || "Quote not found"}</p>
        <Button
          className="mt-4"
          onClick={() => router.push("/partner/quotes")}
        >
          Back to Quotes
        </Button>
      </div>
    );
  }

  const badgeProps = statusBadgeProps(quote.status);
  const isTerminal = quote.status === "paid" || quote.status === "cancelled";
  const isModeB = quote.partnerMode === "B";

  return (
    <div>
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/partner/quotes")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Quotes
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Quote</h1>
          <Badge variant={badgeProps.variant} className={badgeProps.className}>
            {STATUS_LABELS[quote.status] ?? quote.status}
          </Badge>
          <Badge
            variant="secondary"
            className={`text-xs ${
              isModeB
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            }`}
          >
            {isModeB ? "Direct" : "Referral"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground font-mono">
          {quote.id}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Device Details Card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Device Details</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Device</dt>
              <dd className="font-medium text-right">
                {quote.deviceMake} {quote.deviceModel}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Storage</dt>
              <dd className="font-medium">{quote.deviceStorage}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Grade</dt>
              <dd className="font-medium">Grade {quote.grade}</dd>
            </div>

            <div className="my-1 h-px bg-border" />

            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {isModeB ? "Partner Rate" : "Quote Price"}
              </dt>
              <dd className="text-lg font-bold">
                {fxFormatPrice(quote.quotePriceNZD, partner?.currency ?? "AUD")}
              </dd>
            </div>

            {isModeB && quote.publicPriceNZD != null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Public Price</dt>
                <dd className="text-muted-foreground">
                  {fxFormatPrice(quote.publicPriceNZD, partner?.currency ?? "AUD")}
                </dd>
              </div>
            )}

            {/* Inspection results */}
            {quote.inspectionGrade && (
              <>
                <div className="my-1 h-px bg-border" />
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Inspection Grade</dt>
                  <dd className="font-medium">
                    Grade {quote.inspectionGrade}
                    {quote.inspectionGrade !== quote.grade && (
                      <span className="ml-2 text-xs text-amber-600">
                        (changed from {quote.grade})
                      </span>
                    )}
                  </dd>
                </div>
                {quote.revisedPriceNZD != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Revised Price</dt>
                    <dd className="font-medium">
                      {fxFormatPrice(quote.revisedPriceNZD, partner?.currency ?? "AUD")}
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </div>

        {/* Dates & Info Card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Timeline</h2>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(quote.createdAt)}</dd>
            </div>
            {quote.expiresAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Expires</dt>
                <dd>{formatDate(quote.expiresAt)}</dd>
              </div>
            )}
            {quote.acceptedAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Accepted</dt>
                <dd>{formatDate(quote.acceptedAt)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Status Workflow */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Status</h2>

        {/* Progress stepper */}
        <div className="overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {STATUSES.map((step, idx) => {
              const currentIdx = STATUSES.indexOf(
                quote.status as (typeof STATUSES)[number]
              );
              const isCancelled = quote.status === "cancelled";
              const isCompleted = !isCancelled && currentIdx > idx;
              const isCurrent = !isCancelled && quote.status === step;
              const isFuture = !isCancelled && currentIdx < idx;

              return (
                <React.Fragment key={step}>
                  {idx > 0 && (
                    <div
                      className={`h-0.5 w-6 sm:w-10 ${
                        isCompleted
                          ? "bg-emerald-500"
                          : isCurrent
                          ? "bg-primary"
                          : "bg-border"
                      }`}
                    />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        isCompleted
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                          : isFuture
                          ? "bg-muted text-muted-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`text-[11px] whitespace-nowrap ${
                        isCurrent
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABELS[step]}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Cancelled state indicator */}
            {quote.status === "cancelled" && (
              <>
                <div className="h-0.5 w-6 sm:w-10 bg-destructive/40" />
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-white">
                    <XCircle className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-destructive whitespace-nowrap">
                    Cancelled
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Terminal state messages */}
        {isTerminal && (
          <div className="mt-4">
            {quote.status === "paid" && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Quote completed — payment has been made.
              </div>
            )}
            {quote.status === "cancelled" && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                This quote has been cancelled.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
