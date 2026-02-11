"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Smartphone,
  User,
  ClipboardCheck,
} from "lucide-react";
import { useFX } from "@/lib/use-fx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuoteStatus =
  | "quoted"
  | "accepted"
  | "shipped"
  | "received"
  | "inspected"
  | "paid"
  | "cancelled";

type Grade = "A" | "B" | "C" | "D" | "E";

interface QuoteDevice {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface Quote {
  id: string;
  deviceId: string;
  device: QuoteDevice;
  grade: Grade;
  quotePriceNZD: number;
  displayCurrency: string;
  status: QuoteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentMethod?: "payid" | "bank_transfer";
  payIdPhone?: string;
  bankBSB?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  partnerId?: string;
  partnerName?: string;
  partnerMode?: string;
  inspectionGrade?: Grade;
  revisedPriceNZD?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES: QuoteStatus[] = [
  "quoted",
  "accepted",
  "shipped",
  "received",
  "inspected",
  "paid",
];

const GRADES: Grade[] = ["A", "B", "C", "D", "E"];

const STATUS_LABELS: Record<QuoteStatus, string> = {
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

function getStatusBadgeVariant(
  status: QuoteStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "quoted":
      return "default";
    case "accepted":
      return "secondary";
    case "shipped":
      return "outline";
    case "received":
      return "secondary";
    case "inspected":
      return "default";
    case "paid":
      return "default"; // we override className for green
    case "cancelled":
      return "destructive";
  }
}

function getStatusBadgeClassName(status: QuoteStatus): string {
  if (status === "paid") {
    return "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80";
  }
  return "";
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Returns the next logical status for a forward transition, or null if no action. */
function getNextStatus(current: QuoteStatus): QuoteStatus | null {
  const idx = STATUSES.indexOf(current);
  if (idx === -1 || idx >= STATUSES.length - 1) return null;
  return STATUSES[idx + 1];
}

/** Label for the primary action button based on current status. */
function getActionLabel(current: QuoteStatus): string | null {
  switch (current) {
    case "quoted":
      return "Mark Accepted";
    case "accepted":
      return "Mark Shipped";
    case "shipped":
      return "Mark Received";
    case "received":
      return "Begin Inspection";
    case "inspected":
      return "Mark Paid";
    default:
      return null;
  }
}

/** Variant for the primary action button. */
function getActionVariant(
  current: QuoteStatus
): "default" | "secondary" | "outline" {
  if (current === "quoted") return "secondary";
  return "default";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formatPrice: fxFormatPrice } = useFX();

  // ---- data state ---------------------------------------------------------
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- action state -------------------------------------------------------
  const [actionLoading, setActionLoading] = useState(false);

  // ---- cancel dialog state ------------------------------------------------
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ---- inspection dialog state --------------------------------------------
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionGrade, setInspectionGrade] = useState<Grade | "">("");
  const [revisedPrice, setRevisedPrice] = useState("");
  const [inspectionLoading, setInspectionLoading] = useState(false);

  // ---- fetch quote --------------------------------------------------------
  const fetchQuote = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/quotes/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Quote not found");
        return res.json();
      })
      .then((data: Quote) => setQuote(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // ---- update quote helper ------------------------------------------------
  const updateQuote = async (
    body: Record<string, unknown>
  ): Promise<boolean> => {
    const res = await fetch(`/api/admin/quotes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated: Quote = await res.json();
      setQuote(updated);
      return true;
    }
    return false;
  };

  // ---- advance status (non-inspection) ------------------------------------
  const handleAdvanceStatus = async () => {
    if (!quote) return;
    const next = getNextStatus(quote.status);
    if (!next || quote.status === "received") return; // "received" uses inspection dialog
    setActionLoading(true);
    try {
      await updateQuote({ status: next });
    } finally {
      setActionLoading(false);
    }
  };

  // ---- cancel quote -------------------------------------------------------
  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      const ok = await updateQuote({ status: "cancelled" });
      if (ok) setCancelOpen(false);
    } finally {
      setCancelLoading(false);
    }
  };

  // ---- open inspection dialog ---------------------------------------------
  const openInspection = () => {
    if (!quote) return;
    setInspectionGrade("");
    setRevisedPrice("");
    setInspectionOpen(true);
  };

  // ---- submit inspection --------------------------------------------------
  const handleInspection = async () => {
    if (!quote || !inspectionGrade) return;
    setInspectionLoading(true);
    try {
      const body: Record<string, unknown> = {
        status: "inspected",
        inspectionGrade,
      };
      // Only include revised price if the grade differs from original
      if (inspectionGrade !== quote.grade && revisedPrice !== "") {
        const parsed = parseFloat(revisedPrice);
        if (!isNaN(parsed) && parsed >= 0) {
          body.revisedPriceNZD = parsed;
        }
      }
      const ok = await updateQuote(body);
      if (ok) setInspectionOpen(false);
    } finally {
      setInspectionLoading(false);
    }
  };

  const gradeChanged =
    inspectionGrade !== "" && !!quote && inspectionGrade !== quote.grade;

  // ---- determine if the quote is in a terminal state ----------------------
  const isTerminal =
    quote?.status === "paid" || quote?.status === "cancelled";

  // ---- render: loading ----------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading quote...
        </span>
      </div>
    );
  }

  // ---- render: error / not found ------------------------------------------
  if (error || !quote) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {error ?? "Quote not found."}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/quotes")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Quotes
        </Button>
      </div>
    );
  }

  // ---- render: main -------------------------------------------------------
  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* 1. Header                                                        */}
      {/* ---------------------------------------------------------------- */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/quotes")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Quotes
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Quote {quote.id}
          </h1>
          <Badge
            variant={getStatusBadgeVariant(quote.status)}
            className={getStatusBadgeClassName(quote.status)}
          >
            {STATUS_LABELS[quote.status]}
          </Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* -------------------------------------------------------------- */}
        {/* 2. Quote Details Card                                           */}
        {/* -------------------------------------------------------------- */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Quote Details</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Device</dt>
              <dd className="font-medium text-right">
                {quote.device.make} {quote.device.model}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Storage</dt>
              <dd className="font-medium">{quote.device.storage}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Original Grade</dt>
              <dd className="font-medium">Grade {quote.grade}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Quote Price</dt>
              <dd className="font-medium">
                {fxFormatPrice(quote.quotePriceNZD, "AUD")}
              </dd>
            </div>

            <div className="my-1 h-px bg-border" />

            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(quote.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Expires</dt>
              <dd>{formatDate(quote.expiresAt)}</dd>
            </div>
            {quote.acceptedAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Accepted</dt>
                <dd>{formatDate(quote.acceptedAt)}</dd>
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
                {quote.revisedPriceNZD !== undefined &&
                  quote.revisedPriceNZD !== null && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Revised Price</dt>
                      <dd className="font-medium">
                        {fxFormatPrice(quote.revisedPriceNZD, "AUD")}
                        {quote.revisedPriceNZD !== quote.quotePriceNZD && (
                          <span
                            className={cn(
                              "ml-2 text-xs",
                              quote.revisedPriceNZD < quote.quotePriceNZD
                                ? "text-destructive"
                                : "text-emerald-600"
                            )}
                          >
                            ({quote.revisedPriceNZD < quote.quotePriceNZD
                              ? "-"
                              : "+"}
                            {fxFormatPrice(
                              Math.abs(
                                quote.revisedPriceNZD - quote.quotePriceNZD
                              ), "AUD"
                            )}
                            )
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
              </>
            )}
          </dl>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* 3. Customer Details Card                                        */}
        {/* -------------------------------------------------------------- */}
        {(quote.customerName ||
          quote.customerEmail ||
          quote.customerPhone) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Customer Details</h2>
            </div>

            <dl className="grid gap-3 text-sm">
              {quote.customerName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{quote.customerName}</dd>
                </div>
              )}
              {quote.customerEmail && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${quote.customerEmail}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {quote.customerEmail}
                    </a>
                  </dd>
                </div>
              )}
              {quote.customerPhone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{quote.customerPhone}</dd>
                </div>
              )}

              {/* Payment details */}
              {quote.paymentMethod && (
                <>
                  <div className="my-1 h-px bg-border" />
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Payment Method</dt>
                    <dd className="font-medium">
                      {quote.paymentMethod === "payid"
                        ? "PayID"
                        : "Bank Transfer"}
                    </dd>
                  </div>
                  {quote.paymentMethod === "payid" && quote.payIdPhone && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">PayID Phone</dt>
                      <dd className="font-mono text-xs">{quote.payIdPhone}</dd>
                    </div>
                  )}
                  {quote.paymentMethod === "bank_transfer" && (
                    <>
                      {quote.bankAccountName && (
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">
                            Account Name
                          </dt>
                          <dd>{quote.bankAccountName}</dd>
                        </div>
                      )}
                      {quote.bankBSB && (
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">BSB</dt>
                          <dd className="font-mono text-xs">
                            {quote.bankBSB}
                          </dd>
                        </div>
                      )}
                      {quote.bankAccountNumber && (
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">
                            Account Number
                          </dt>
                          <dd className="font-mono text-xs">
                            {quote.bankAccountNumber}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 3b. Partner Attribution Card                                      */}
      {/* ---------------------------------------------------------------- */}
      {quote.partnerId && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Partner Attribution</h2>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Partner</dt>
              <dd>
                <button
                  onClick={() =>
                    router.push(`/admin/partners/${quote.partnerId}`)
                  }
                  className="text-primary underline-offset-4 hover:underline font-medium"
                >
                  {quote.partnerName || quote.partnerId}
                </button>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mode</dt>
              <dd className="font-medium">
                {quote.partnerMode === "A"
                  ? "Mode A (Referral)"
                  : quote.partnerMode === "B"
                  ? "Mode B (Direct)"
                  : quote.partnerMode || "\u2014"}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 4. Status Workflow / Actions Card                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Workflow</h2>
        </div>

        {/* Progress stepper */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {STATUSES.map((step, idx) => {
              const currentIdx = STATUSES.indexOf(quote.status);
              const isCancelled = quote.status === "cancelled";
              const isCompleted = !isCancelled && currentIdx > idx;
              const isCurrent = !isCancelled && quote.status === step;
              const isFuture = !isCancelled && currentIdx < idx;

              return (
                <React.Fragment key={step}>
                  {idx > 0 && (
                    <div
                      className={cn(
                        "h-0.5 w-6 sm:w-10",
                        isCompleted
                          ? "bg-emerald-500"
                          : isCurrent
                          ? "bg-primary"
                          : "bg-border"
                      )}
                    />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                        isCompleted &&
                          "bg-emerald-500 text-white",
                        isCurrent &&
                          "bg-primary text-primary-foreground ring-2 ring-primary/30",
                        isFuture &&
                          "bg-muted text-muted-foreground",
                        isCancelled &&
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] whitespace-nowrap",
                        isCurrent
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {STATUS_LABELS[step]}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Show cancelled state indicator if applicable */}
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

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Primary action */}
          {!isTerminal && getActionLabel(quote.status) && (
            <>
              {quote.status === "received" ? (
                <Button onClick={openInspection}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Begin Inspection
                </Button>
              ) : (
                <Button
                  variant={getActionVariant(quote.status)}
                  onClick={handleAdvanceStatus}
                  disabled={actionLoading}
                >
                  {actionLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {getActionLabel(quote.status)}
                </Button>
              )}
            </>
          )}

          {/* Terminal state messages */}
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

          {/* Cancel button — available for non-terminal statuses */}
          {!isTerminal && (
            <Button
              variant="destructive"
              className="ml-auto"
              onClick={() => setCancelOpen(true)}
            >
              Cancel Quote
            </Button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Inspection Dialog                                              */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={inspectionOpen} onOpenChange={setInspectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Device Inspection</DialogTitle>
            <DialogDescription>
              Inspect the device and assign a grade. If the grade differs from
              the original ({quote.grade}), you can set a revised price.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Device summary */}
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
              <p className="font-medium">
                {quote.device.make} {quote.device.model} ({quote.device.storage}
                )
              </p>
              <p className="mt-1 text-muted-foreground">
                Original: Grade {quote.grade} &mdash;{" "}
                {fxFormatPrice(quote.quotePriceNZD, "AUD")}
              </p>
            </div>

            {/* Inspection grade select */}
            <div className="grid gap-2">
              <Label htmlFor="inspection-grade">Inspection Grade</Label>
              <Select
                value={inspectionGrade}
                onValueChange={(val) => setInspectionGrade(val as Grade)}
              >
                <SelectTrigger id="inspection-grade">
                  <SelectValue placeholder="Select grade..." />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      Grade {g}
                      {g === quote.grade ? " (original)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Revised price — only shown if grade changed */}
            {gradeChanged && (
              <div className="grid gap-2">
                <Label htmlFor="revised-price">
                  Revised Price (NZD)
                </Label>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-xs text-muted-foreground">
                    Grade changed from {quote.grade} to {inspectionGrade}.
                    Enter the revised quote price.
                  </p>
                </div>
                <Input
                  id="revised-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={quote.quotePriceNZD.toFixed(2)}
                  value={revisedPrice}
                  onChange={(e) => setRevisedPrice(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInspectionOpen(false)}
              disabled={inspectionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInspection}
              disabled={
                !inspectionGrade ||
                inspectionLoading ||
                (gradeChanged && revisedPrice === "")
              }
            >
              {inspectionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Complete Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Cancel Confirmation Dialog                                        */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Quote</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this quote for{" "}
              <span className="font-semibold">
                {quote.device.make} {quote.device.model} ({quote.device.storage}
                )
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelLoading}
            >
              Keep Quote
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelLoading}
            >
              {cancelLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cancel Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
