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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Package,
  User,
  ClipboardCheck,
} from "lucide-react";
import { useFX } from "@/lib/use-fx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BulkQuoteStatus =
  | "estimated"
  | "accepted"
  | "received"
  | "inspected"
  | "paid"
  | "cancelled";

type Grade = "A" | "B" | "C" | "D" | "E";

interface DeviceLine {
  id: string;
  rawInput: string;
  deviceId: string | null;
  deviceName: string | null;
  matchConfidence: string;
  quantity: number;
  assumedGrade: string;
  indicativePriceNZD: number;
  actualGrade: string | null;
  actualPriceNZD: number | null;
  inspectionNotes: string | null;
}

interface BulkQuote {
  id: string;
  businessName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  type: string;
  assumedGrade: string;
  totalDevices: number;
  totalIndicativeNZD: number;
  matchedCount: number;
  unmatchedCount: number;
  status: BulkQuoteStatus;
  customerId: string | null;
  paymentMethod: string | null;
  payIdPhone: string | null;
  bankBSB: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  createdAt: string | null;
  acceptedAt: string | null;
  receivedAt: string | null;
  paidAt: string | null;
  devices: DeviceLine[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES: BulkQuoteStatus[] = [
  "estimated",
  "accepted",
  "received",
  "inspected",
  "paid",
];

const GRADES: Grade[] = ["A", "B", "C", "D", "E"];

const STATUS_LABELS: Record<BulkQuoteStatus, string> = {
  estimated: "Estimated",
  accepted: "Accepted",
  received: "Received",
  inspected: "Inspected",
  paid: "Paid",
  cancelled: "Cancelled",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadgeVariant(
  status: BulkQuoteStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "estimated":
      return "default";
    case "accepted":
      return "secondary";
    case "received":
      return "outline";
    case "inspected":
      return "default";
    case "paid":
      return "default";
    case "cancelled":
      return "destructive";
  }
}

function getStatusBadgeClassName(status: BulkQuoteStatus): string {
  if (status === "paid")
    return "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80";
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

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getNextStatus(current: BulkQuoteStatus): BulkQuoteStatus | null {
  const idx = STATUSES.indexOf(current);
  if (idx === -1 || idx >= STATUSES.length - 1) return null;
  return STATUSES[idx + 1];
}

function getActionLabel(current: BulkQuoteStatus): string | null {
  switch (current) {
    case "estimated":
      return "Mark Accepted";
    case "accepted":
      return "Mark Received";
    case "received":
      return "Complete Inspection";
    case "inspected":
      return "Mark Paid";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BulkQuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formatPrice: fxFormatPrice } = useFX();

  const [quote, setQuote] = useState<BulkQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Inspection dialog
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectLine, setInspectLine] = useState<DeviceLine | null>(null);
  const [inspectionGrade, setInspectionGrade] = useState<Grade | "">("");
  const [inspectionPrice, setInspectionPrice] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [inspectionLoading, setInspectionLoading] = useState(false);

  // Fetch quote
  const fetchQuote = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/bulk-quotes/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Bulk quote not found");
        return res.json();
      })
      .then((data: BulkQuote) => setQuote(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // Update bulk quote status
  const updateStatus = async (newStatus: string): Promise<boolean> => {
    const res = await fetch(`/api/admin/bulk-quotes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      fetchQuote(); // re-fetch to get full updated data
      return true;
    }
    return false;
  };

  // Advance status
  const handleAdvanceStatus = async () => {
    if (!quote) return;
    const next = getNextStatus(quote.status);
    if (!next) return;
    setActionLoading(true);
    try {
      await updateStatus(next);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel
  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      const ok = await updateStatus("cancelled");
      if (ok) setCancelOpen(false);
    } finally {
      setCancelLoading(false);
    }
  };

  // Open inspection dialog for a device line
  const openInspection = (line: DeviceLine) => {
    setInspectLine(line);
    setInspectionGrade((line.actualGrade as Grade) || "");
    setInspectionPrice(
      line.actualPriceNZD !== null ? String(line.actualPriceNZD) : ""
    );
    setInspectionNotes(line.inspectionNotes || "");
    setInspectionOpen(true);
  };

  // Submit device inspection
  const handleInspection = async () => {
    if (!inspectLine || !inspectionGrade) return;
    setInspectionLoading(true);
    try {
      const body: Record<string, unknown> = {
        actualGrade: inspectionGrade,
        inspectionNotes: inspectionNotes || null,
      };
      if (inspectionPrice !== "") {
        body.actualPriceNZD = parseFloat(inspectionPrice);
      }

      const res = await fetch(
        `/api/admin/bulk-quotes/${id}/devices/${inspectLine.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        setInspectionOpen(false);
        fetchQuote(); // refresh
      }
    } finally {
      setInspectionLoading(false);
    }
  };

  const isTerminal =
    quote?.status === "paid" || quote?.status === "cancelled";

  const inspectedCount =
    quote?.devices.filter((d) => d.actualGrade).length ?? 0;
  const totalLines = quote?.devices.length ?? 0;

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading bulk quote...
        </span>
      </div>
    );
  }

  // Error / not found
  if (error || !quote) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {error ?? "Bulk quote not found."}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/bulk-quotes")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Bulk Quotes
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/bulk-quotes")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Bulk Quotes
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Bulk Quote {quote.id.substring(0, 8)}
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
        {/* Quote Details Card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Quote Details</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Business</dt>
              <dd className="font-medium">
                {quote.businessName || "\u2014"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium capitalize">{quote.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Assumed Grade</dt>
              <dd className="font-medium">Grade {quote.assumedGrade}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total Devices</dt>
              <dd className="font-medium">{quote.totalDevices}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total Value</dt>
              <dd className="font-medium">
                {fxFormatPrice(quote.totalIndicativeNZD, "AUD")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Matched / Unmatched</dt>
              <dd className="font-medium">
                {quote.matchedCount} / {quote.unmatchedCount}
              </dd>
            </div>

            <div className="my-1 h-px bg-border" />

            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(quote.createdAt)}</dd>
            </div>
            {quote.acceptedAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Accepted</dt>
                <dd>{formatDate(quote.acceptedAt)}</dd>
              </div>
            )}
            {quote.receivedAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Received</dt>
                <dd>{formatDate(quote.receivedAt)}</dd>
              </div>
            )}
            {quote.paidAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid</dt>
                <dd>{formatDate(quote.paidAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Contact Details Card */}
        {(quote.contactName || quote.contactEmail || quote.contactPhone) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Contact Details</h2>
            </div>

            <dl className="grid gap-3 text-sm">
              {quote.contactName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Contact</dt>
                  <dd className="font-medium">{quote.contactName}</dd>
                </div>
              )}
              {quote.contactEmail && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${quote.contactEmail}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {quote.contactEmail}
                    </a>
                  </dd>
                </div>
              )}
              {quote.contactPhone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{quote.contactPhone}</dd>
                </div>
              )}

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
                          <dd className="font-mono text-xs">{quote.bankBSB}</dd>
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

            {quote.customerId && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  router.push(`/admin/customers/${quote.customerId}`)
                }
              >
                View Customer Profile
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Workflow Card */}
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
                        isCompleted && "bg-emerald-500 text-white",
                        isCurrent &&
                          "bg-primary text-primary-foreground ring-2 ring-primary/30",
                        isFuture && "bg-muted text-muted-foreground",
                        isCancelled && "bg-muted text-muted-foreground"
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

        {/* Inspection progress */}
        {quote.status === "received" && (
          <div className="mb-4 rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">
              Inspection progress:{" "}
              <span className="font-medium text-foreground">
                {inspectedCount} of {totalLines}
              </span>{" "}
              devices inspected
            </p>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{
                  width: `${totalLines > 0 ? (inspectedCount / totalLines) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {!isTerminal && getActionLabel(quote.status) && (
            <Button
              onClick={handleAdvanceStatus}
              disabled={
                actionLoading ||
                (quote.status === "received" && inspectedCount < totalLines)
              }
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {getActionLabel(quote.status)}
            </Button>
          )}

          {quote.status === "paid" && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Bulk quote completed — payment has been made.
            </div>
          )}
          {quote.status === "cancelled" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              This bulk quote has been cancelled.
            </div>
          )}

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

      {/* Device Breakdown Table */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">
          Device Breakdown ({totalLines} lines)
        </h2>
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Raw Input</TableHead>
                <TableHead>Matched Device</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Indicative (AUD)</TableHead>
                <TableHead>Actual Grade</TableHead>
                <TableHead className="text-right">Actual (AUD)</TableHead>
                {quote.status === "received" && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.devices.map((line, idx) => (
                <TableRow key={line.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm">
                    {line.rawInput}
                  </TableCell>
                  <TableCell className="text-sm">
                    {line.deviceName || (
                      <span className="text-muted-foreground italic">
                        Unmatched
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        line.matchConfidence === "high"
                          ? "default"
                          : line.matchConfidence === "medium"
                          ? "secondary"
                          : "destructive"
                      }
                      className={
                        line.matchConfidence === "high"
                          ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80"
                          : line.matchConfidence === "medium"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : ""
                      }
                    >
                      {line.matchConfidence}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell>{line.assumedGrade}</TableCell>
                  <TableCell className="text-right">
                    {line.indicativePriceNZD > 0
                      ? fxFormatPrice(line.indicativePriceNZD, "AUD")
                      : "\u2014"}
                  </TableCell>
                  <TableCell>
                    {line.actualGrade ? (
                      <Badge variant="outline">
                        {line.actualGrade}
                        {line.actualGrade !== line.assumedGrade && (
                          <span className="ml-1 text-amber-600">*</span>
                        )}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.actualPriceNZD !== null
                      ? fxFormatPrice(line.actualPriceNZD, "AUD")
                      : "\u2014"}
                  </TableCell>
                  {quote.status === "received" && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openInspection(line)}
                      >
                        {line.actualGrade ? "Edit" : "Inspect"}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Inspection Dialog */}
      <Dialog open={inspectionOpen} onOpenChange={setInspectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Device Inspection</DialogTitle>
            <DialogDescription>
              Inspect this device and assign a grade and actual price.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {inspectLine && (
              <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                <p className="font-medium">
                  {inspectLine.deviceName || inspectLine.rawInput}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Assumed: Grade {inspectLine.assumedGrade} &mdash;{" "}
                  {fxFormatPrice(
                    inspectLine.quantity > 0
                      ? inspectLine.indicativePriceNZD / inspectLine.quantity
                      : 0, "AUD"
                  )}/unit
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Actual Grade</Label>
              <Select
                value={inspectionGrade}
                onValueChange={(val) => setInspectionGrade(val as Grade)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grade..." />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      Grade {g}
                      {g === inspectLine?.assumedGrade ? " (assumed)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {inspectionGrade &&
              inspectLine &&
              inspectionGrade !== inspectLine.assumedGrade && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-xs text-muted-foreground">
                    Grade changed from {inspectLine.assumedGrade} to{" "}
                    {inspectionGrade}
                  </p>
                </div>
              )}

            <div className="grid gap-2">
              <Label>Actual Price (NZD per unit)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter actual price"
                value={inspectionPrice}
                onChange={(e) => setInspectionPrice(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Inspection Notes</Label>
              <Input
                placeholder="Optional notes..."
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
              />
            </div>
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
              disabled={!inspectionGrade || inspectionLoading}
            >
              {inspectionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Bulk Quote</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this bulk quote for{" "}
              <span className="font-semibold">
                {quote.businessName || quote.id.substring(0, 8)}
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
