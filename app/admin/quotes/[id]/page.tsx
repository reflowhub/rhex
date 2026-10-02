"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Clock,
  Package,
  History,
  PauseCircle,
  Truck,
  Download,
} from "lucide-react";
import { daysSince } from "@/lib/label-deadlines";
import {
  formatMoney,
  originalAmount,
  payableAmount,
  toQuoteCurrency,
} from "@/lib/quote-money";
import HelpLink from "@/components/admin/help-link";
import AuAddressFields from "@/components/au-address-fields";
import {
  isAuAddressComplete,
  toAuAddressInput,
  EMPTY_AU_ADDRESS,
  type AuAddress,
  type AuAddressInput,
} from "@/lib/au-address";
import DeviceSearchSelect, {
  SelectedDevice,
} from "@/components/admin/device-search-select";
import {
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  LATE_DECISIONS,
  LATE_DECISION_LABELS,
  QUOTE_STATUS_LABELS as STATUS_LABELS,
  type CancelReason,
  type LateDecision,
  type QuoteStatus,
} from "@/lib/quote-status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Grade = "A" | "B" | "C" | "D" | "E";

interface QuoteDevice {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface StatusHistoryEntry {
  from: QuoteStatus;
  to: QuoteStatus;
  actor: string;
  actorId: string | null;
  at: string | null;
  reason: string | null;
}

interface Quote {
  id: string;
  deviceId: string;
  device: QuoteDevice;
  grade: Grade;
  quotePriceNZD: number;
  quotePriceDisplay?: number | null;
  displayCurrency: string;
  fxRate?: number | null;
  status: QuoteStatus;
  tradeInRef?: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  shippingAddressParts?: AuAddress | null;
  paymentMethod?: "payid" | "bank_transfer";
  payIdPhone?: string;
  bankBSB?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  imei?: string;
  receivedImei?: string | null;
  receivedSerial?: string | null;
  lateArrival?: boolean | null;
  lateDecision?: LateDecision | null;
  lateDecisionNote?: string | null;
  customerId?: string;
  partnerId?: string;
  partnerName?: string;
  partnerMode?: string;
  inspectionGrade?: Grade;
  revisedPriceNZD?: number;
  revisedPriceDisplay?: number | null;
  revisedDeviceId?: string;
  revisedDeviceMake?: string;
  revisedDeviceModel?: string;
  revisedDeviceStorage?: string;
  revisedAt?: string;
  revisionExpiresAt?: string;
  revisionAutoExpired?: boolean;
  revisionForceAccepted?: boolean | null;
  returningAt?: string;
  returnedAt?: string;
  heldFrom?: QuoteStatus | null;
  holdReason?: string | null;
  returnReason?: string | null;
  returnTrackingNumber?: string | null;
  cancelReason?: CancelReason | null;
  cancelNote?: string | null;
  platform?: string;
  geoCountry?: string;
  geoCity?: string;
  geoRegion?: string;
  sandbox?: boolean;
  labelId?: string | null;
  trackingNumber?: string | null;
  labelCostAUD?: number | null;
  labelSentAt?: string | null;
  postByAt?: string | null;
  expectedByAt?: string | null;
  payout?: {
    method: string | null;
    payIdPhone: string | null;
    bankBSB: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
    amount: number;
    currency: string;
    amountNZD: number;
    paidAt: string | null;
    paidBy: string | null;
  } | null;
  statusHistory: StatusHistoryEntry[];
  allowedTransitions: QuoteStatus[];
}

/** "$135.00 AUD ($146.00 NZD)", or just the NZD amount for NZD quotes. */
function formatWithNZD(
  money: { amount: number; currency: string },
  amountNZD: number
): string {
  const main = formatMoney(money.amount, money.currency);
  return money.currency === "NZD"
    ? main
    : `${main} (${formatMoney(amountNZD, "NZD")})`;
}

function payoutDestination(p: NonNullable<Quote["payout"]>): string {
  if (p.method === "payid") return `PayID ${p.payIdPhone ?? ""}`.trim();
  if (p.method === "bank_transfer") {
    return [`BSB ${p.bankBSB ?? "—"}`, p.bankAccountNumber, p.bankAccountName]
      .filter(Boolean)
      .join(" · ");
  }
  return "—";
}

/** Dialogs that collect input before a transition. */
type ReasonDialogKind = "hold" | "release" | "return" | "force";

const REASON_DIALOGS: Record<
  ReasonDialogKind,
  { title: string; description: string; label: string; submit: string; help: string }
> = {
  hold: {
    title: "Put Quote On Hold",
    description:
      "Use for ownership, blacklist or fraud checks (terms §3). Payment is blocked while the quote is on hold.",
    label: "Reason",
    submit: "Put On Hold",
    help: "trade-ins/on-hold",
  },
  release: {
    title: "Release Hold",
    description: "The quote goes back to the status it was held from.",
    label: "Release note",
    submit: "Release Hold",
    help: "trade-ins/on-hold",
  },
  return: {
    title: "Return Device",
    description:
      "The quote moves to Returning and the device is sent back to the customer.",
    label: "Reason",
    submit: "Return Device",
    help: "trade-ins/return-device",
  },
  force: {
    title: "Accept Revision on Customer's Behalf",
    description:
      "Moves the quote to Inspected at the revised price. Record why you're accepting for the customer.",
    label: "Reason",
    submit: "Accept Revision",
    help: "trade-ins/revised-offer",
  },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADES: Grade[] = ["A", "B", "C", "D", "E"];

const HAPPY_PATH: QuoteStatus[] = [
  "quoted",
  "accepted",
  "shipped",
  "received",
  "inspected",
  "paid",
];

/** Build the stepper steps from the path the quote took. */
function getStepperStatuses(quote: Quote): QuoteStatus[] {
  const status =
    quote.status === "on_hold" && quote.heldFrom ? quote.heldFrom : quote.status;
  const upToReceived: QuoteStatus[] = ["quoted", "accepted", "shipped", "received"];
  const wasRevised = !!quote.revisedAt;

  if (status === "expired") {
    return quote.acceptedAt
      ? ["quoted", "accepted", "expired"]
      : ["quoted", "expired"];
  }
  if (status === "returning" || status === "returned") {
    return [
      ...upToReceived,
      ...(wasRevised ? (["revised"] as QuoteStatus[]) : []),
      "returning",
      "returned",
    ];
  }
  if (status === "revised" || wasRevised) {
    return [...upToReceived, "revised", "inspected", "paid"];
  }
  return HAPPY_PATH;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadgeVariant(
  status: QuoteStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "quoted":
    case "revised":
    case "inspected":
    case "paid":
      return "default";
    case "accepted":
    case "received":
    case "returned":
    case "expired":
      return "secondary";
    case "shipped":
    case "returning":
    case "on_hold":
      return "outline";
    case "cancelled":
      return "destructive";
  }
}

function getStatusBadgeClassName(status: QuoteStatus): string {
  if (status === "paid") {
    return "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80";
  }
  if (status === "revised") {
    return "border-transparent bg-amber-500 text-white hover:bg-amber-500/80";
  }
  if (status === "returning") {
    return "border-amber-300 text-amber-700";
  }
  if (status === "on_hold") {
    return "border-red-300 text-red-700";
  }
  return "";
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ---- data state ---------------------------------------------------------
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- action state -------------------------------------------------------
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ---- cancel dialog state ------------------------------------------------
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancelReason | "">("");
  const [cancelNote, setCancelNote] = useState("");

  // ---- reason dialog state (hold / release / return / force) --------------
  const [reasonDialog, setReasonDialog] = useState<{
    kind: ReasonDialogKind;
    target: QuoteStatus;
  } | null>(null);
  const [reasonText, setReasonText] = useState("");

  // ---- receive dialog state -----------------------------------------------
  const [receiveTarget, setReceiveTarget] = useState<QuoteStatus | null>(null);
  const [receiveImei, setReceiveImei] = useState("");
  const [receiveSerial, setReceiveSerial] = useState("");

  // ---- accept dialog state ------------------------------------------------
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptAddress, setAcceptAddress] = useState<AuAddressInput>(EMPTY_AU_ADDRESS);
  const [acceptForm, setAcceptForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    paymentMethod: "",
    payIdPhone: "",
    bankBSB: "",
    bankAccountNumber: "",
    bankAccountName: "",
  });

  // ---- label form state ---------------------------------------------------
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [labelTracking, setLabelTracking] = useState("");
  const [labelCost, setLabelCost] = useState("");
  const [labelLoading, setLabelLoading] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelFormKey, setLabelFormKey] = useState(0);

  // ---- mark paid dialog state ---------------------------------------------
  const [payOpen, setPayOpen] = useState(false);

  // ---- mark returned dialog state -----------------------------------------
  const [returnedOpen, setReturnedOpen] = useState(false);
  const [returnTracking, setReturnTracking] = useState("");

  // ---- inspection dialog state --------------------------------------------
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionGrade, setInspectionGrade] = useState<Grade | "">("");
  const [revisedPrice, setRevisedPrice] = useState("");
  const [lateDecision, setLateDecision] = useState<LateDecision | "">("");
  const [lateDecisionNote, setLateDecisionNote] = useState("");
  const [changeDevice, setChangeDevice] = useState(false);
  const [revisedDevice, setRevisedDevice] = useState<SelectedDevice | null>(
    null
  );

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

  // ---- transition helper --------------------------------------------------
  /** Move the quote to `status`; returns true on success. */
  const transition = async (
    status: QuoteStatus,
    fields: Record<string, unknown> = {}
  ): Promise<boolean> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...fields }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to update quote");
        return false;
      }
      setQuote(data);
      return true;
    } catch {
      setActionError("Failed to update quote");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // ---- send or replace the shipping label ---------------------------------
  const handleSendLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote || !labelFile) return;
    setLabelLoading(true);
    setLabelError(null);
    try {
      const form = new FormData();
      form.append("file", labelFile);
      form.append("trackingNumber", labelTracking);
      form.append("labelCostAUD", labelCost);
      if (quote.labelId) form.append("replaceLabelId", quote.labelId);
      const res = await fetch(`/api/admin/quotes/${id}/label`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setLabelError(data.error ?? "Failed to send label");
        return;
      }
      setQuote(data);
      setLabelFile(null);
      setLabelTracking("");
      setLabelCost("");
      setLabelFormKey((k) => k + 1);
    } catch {
      setLabelError("Failed to send label");
    } finally {
      setLabelLoading(false);
    }
  };

  // ---- open dialogs -------------------------------------------------------
  const openReasonDialog = (kind: ReasonDialogKind, target: QuoteStatus) => {
    setReasonText("");
    setActionError(null);
    setReasonDialog({ kind, target });
  };

  const openReceive = (target: QuoteStatus) => {
    setReceiveImei(quote?.imei ?? "");
    setReceiveSerial("");
    setActionError(null);
    setReceiveTarget(target);
  };

  const openAccept = () => {
    if (!quote) return;
    setAcceptForm({
      customerName: quote.customerName ?? "",
      customerEmail: quote.customerEmail ?? "",
      customerPhone: quote.customerPhone ?? "",
      paymentMethod: quote.paymentMethod ?? "",
      payIdPhone: quote.payIdPhone ?? "",
      bankBSB: quote.bankBSB ?? "",
      bankAccountNumber: quote.bankAccountNumber ?? "",
      bankAccountName: quote.bankAccountName ?? "",
    });
    setAcceptAddress(toAuAddressInput(quote.shippingAddressParts));
    setActionError(null);
    setAcceptOpen(true);
  };

  const openCancel = () => {
    setCancelReason(quote?.status === "on_hold" ? "surrendered" : "");
    setCancelNote("");
    setActionError(null);
    setCancelOpen(true);
  };

  const openInspection = () => {
    setInspectionGrade("");
    setRevisedPrice("");
    setLateDecision("");
    setLateDecisionNote("");
    setChangeDevice(false);
    setRevisedDevice(null);
    setActionError(null);
    setInspectionOpen(true);
  };

  // ---- submit handlers ----------------------------------------------------
  const handleReasonSubmit = async () => {
    if (!reasonDialog) return;
    const ok = await transition(reasonDialog.target, { reason: reasonText });
    if (ok) setReasonDialog(null);
  };

  const handleReceive = async () => {
    if (!receiveTarget) return;
    const ok = await transition(receiveTarget, {
      imei: receiveImei.trim() || undefined,
      serialNumber: receiveSerial.trim() || undefined,
    });
    if (ok) setReceiveTarget(null);
  };

  const handleAccept = async () => {
    const ok = await transition("accepted", {
      ...acceptForm,
      shippingAddressParts: acceptAddress,
    });
    if (ok) setAcceptOpen(false);
  };

  const handleCancel = async () => {
    const ok = await transition("cancelled", {
      cancelReason,
      reason: cancelNote,
    });
    if (ok) setCancelOpen(false);
  };

  /** Submit the inspection as "inspected" (original quote) or "revised". */
  const handleInspection = async (target: "inspected" | "revised") => {
    if (!quote || !inspectionGrade) return;
    const body: Record<string, unknown> = { inspectionGrade };
    if (target === "revised") body.revisedPriceNZD = parseFloat(revisedPrice);
    if (needsLateDecision) {
      body.lateDecision = lateDecision;
      body.lateDecisionNote = lateDecisionNote.trim() || undefined;
    }
    if (changeDevice && revisedDevice) {
      body.revisedDeviceId = revisedDevice.id;
      body.revisedDeviceMake = revisedDevice.make;
      body.revisedDeviceModel = revisedDevice.model;
      body.revisedDeviceStorage = revisedDevice.storage;
    }
    const ok = await transition(target, body);
    if (ok) setInspectionOpen(false);
  };

  // A late arrival needs an on time / honour / reassess decision (D2)
  const needsLateDecision = !!quote?.lateArrival && !quote.lateDecision;
  const lateDecisionMissing = needsLateDecision && lateDecision === "";
  const gradeChanged =
    inspectionGrade !== "" && !!quote && inspectionGrade !== quote.grade;
  const hasMismatch =
    gradeChanged || (changeDevice && revisedDevice !== null);
  const parsedRevisedPrice = parseFloat(revisedPrice);
  const original = quote ? originalAmount(quote) : null;
  // What the customer would see, at the quote's locked FX rate (D6)
  const revisedCustomerPrice =
    quote && !isNaN(parsedRevisedPrice) && parsedRevisedPrice >= 0
      ? toQuoteCurrency(quote, Math.round(parsedRevisedPrice * 100) / 100)
      : null;
  const revisedPriceValid =
    !isNaN(parsedRevisedPrice) &&
    parsedRevisedPrice >= 0 &&
    !!quote &&
    parsedRevisedPrice < quote.quotePriceNZD &&
    (original?.currency === "NZD" ||
      revisedCustomerPrice === null ||
      revisedCustomerPrice < original!.amount);

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

  const allowed = quote.allowedTransitions ?? [];
  const can = (target: QuoteStatus) => allowed.includes(target);
  const deviceSummary = `${quote.device.make} ${quote.device.model} (${quote.device.storage})`;

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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {quote.tradeInRef ?? `Quote ${quote.id}`}
          </h1>
          <Badge
            variant={getStatusBadgeVariant(quote.status)}
            className={getStatusBadgeClassName(quote.status)}
          >
            {STATUS_LABELS[quote.status] ?? quote.status}
          </Badge>
          {quote.lateArrival && (
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-600"
              title={quote.lateDecisionNote ?? undefined}
            >
              Late arrival
              {quote.lateDecision && ` · ${LATE_DECISION_LABELS[quote.lateDecision]}`}
            </Badge>
          )}
          {quote.sandbox && (
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-600"
            >
              SANDBOX
            </Badge>
          )}
        </div>
      </div>
      {quote.tradeInRef && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Quote {quote.id}
        </p>
      )}

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
              <dt className="text-muted-foreground">IMEI</dt>
              <dd className="font-mono text-xs">
                {quote.imei || <span className="text-muted-foreground font-sans text-sm">Not provided</span>}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Original Grade</dt>
              <dd className="font-medium">Grade {quote.grade}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Quote Price</dt>
              <dd className="font-medium">
                {formatWithNZD(originalAmount(quote), quote.quotePriceNZD)}
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

            {/* Client metadata */}
            {(quote.platform || quote.geoCountry) && (
              <>
                <div className="my-1 h-px bg-border" />
                {quote.platform && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Platform</dt>
                    <dd className="font-medium">{quote.platform}</dd>
                  </div>
                )}
                {quote.geoCountry && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium">
                      {[quote.geoCity, quote.geoRegion, quote.geoCountry]
                        .filter(Boolean)
                        .join(", ")}
                    </dd>
                  </div>
                )}
              </>
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
                {quote.revisedDeviceId && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Revised Device</dt>
                    <dd className="font-medium text-right">
                      {quote.revisedDeviceMake} {quote.revisedDeviceModel}{" "}
                      {quote.revisedDeviceStorage}
                      <span className="ml-2 text-xs text-amber-600">
                        (changed)
                      </span>
                    </dd>
                  </div>
                )}
                {quote.revisedPriceNZD !== undefined &&
                  quote.revisedPriceNZD !== null && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Revised Price</dt>
                      <dd className="font-medium text-right">
                        {formatWithNZD(payableAmount(quote), quote.revisedPriceNZD)}
                        <span className="ml-2 text-xs text-destructive">
                          (−
                          {formatMoney(
                            quote.quotePriceNZD - quote.revisedPriceNZD,
                            "NZD"
                          )}
                          )
                        </span>
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
              {quote.shippingAddress && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="text-right">
                    {quote.shippingAddressParts ? (
                      <>
                        <span className="block">{quote.shippingAddressParts.line1}</span>
                        {quote.shippingAddressParts.line2 && (
                          <span className="block">{quote.shippingAddressParts.line2}</span>
                        )}
                        <span className="block">
                          {quote.shippingAddressParts.suburb}{" "}
                          {quote.shippingAddressParts.state}{" "}
                          {quote.shippingAddressParts.postcode}
                        </span>
                      </>
                    ) : (
                      quote.shippingAddress
                    )}
                  </dd>
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
      {/* 3c. Shipping Label                                                */}
      {/* ---------------------------------------------------------------- */}
      {(quote.status === "accepted" || quote.labelId) && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Shipping Label</h2>
            <HelpLink page="trade-ins/send-label" className="ml-auto" />
          </div>

          {quote.labelId ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Tracking</dt>
                <dd className="font-mono text-xs">{quote.trackingNumber}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Sent</dt>
                <dd>{formatDate(quote.labelSentAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Post by</dt>
                <dd>{formatDate(quote.postByAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Expected by</dt>
                <dd
                  className={cn(
                    (quote.status === "accepted" || quote.status === "shipped") &&
                      quote.expectedByAt &&
                      new Date(quote.expectedByAt) < new Date() &&
                      "font-medium text-destructive"
                  )}
                >
                  {formatDate(quote.expectedByAt)}
                </dd>
              </div>
              {quote.labelCostAUD != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Cost</dt>
                  <dd>${quote.labelCostAUD.toFixed(2)} AUD</dd>
                </div>
              )}
              {(quote.status === "accepted" || quote.status === "shipped") && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Label</dt>
                  <dd>
                    <a
                      href={`/api/quote/${quote.id}/label`}
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download PDF
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            quote.acceptedAt && (
              <p className="text-sm text-amber-700">
                Awaiting label for {daysSince(quote.acceptedAt)} day
                {daysSince(quote.acceptedAt) === 1 ? "" : "s"}. Create it in
                the AusPost portal, then upload it here.
              </p>
            )
          )}

          {quote.status === "accepted" && (
            <form
              key={labelFormKey}
              onSubmit={handleSendLabel}
              className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="label-file">Label PDF</Label>
                <Input
                  id="label-file"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setLabelFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="label-tracking">Tracking number</Label>
                <Input
                  id="label-tracking"
                  value={labelTracking}
                  onChange={(e) => setLabelTracking(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="label-cost">Cost (AUD)</Label>
                <Input
                  id="label-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                  value={labelCost}
                  onChange={(e) => setLabelCost(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant={quote.labelId ? "outline" : "default"}
                disabled={labelLoading || !labelFile || !labelTracking.trim()}
              >
                {labelLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {quote.labelId ? "Replace Label" : "Send Label"}
              </Button>
              <p className="text-xs text-muted-foreground sm:col-span-4">
                {quote.labelId
                  ? "Replacing emails the new label, restarts the 14-day post-by window and queues the old label for a refund."
                  : "The customer is emailed the label and has 14 days to post the device."}
              </p>
              {labelError && (
                <p className="text-sm text-destructive sm:col-span-4">{labelError}</p>
              )}
            </form>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 4. Status Workflow / Actions Card                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Workflow</h2>
          <HelpLink page="trade-ins" label="What each status means" className="ml-auto" />
        </div>

        {/* Progress stepper */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {getStepperStatuses(quote).map((step, idx, steps) => {
              const position =
                quote.status === "on_hold" && quote.heldFrom
                  ? quote.heldFrom
                  : quote.status;
              const currentIdx = steps.indexOf(position);
              const isCancelled = quote.status === "cancelled";
              const isCompleted = !isCancelled && currentIdx > idx;
              const isCurrent = !isCancelled && position === step;
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

        {/* Status messages */}
        <div className="mb-4 space-y-2 text-sm empty:hidden">
          {quote.status === "on_hold" && (
            <div className="flex items-start gap-2 text-red-700">
              <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                On hold from {STATUS_LABELS[quote.heldFrom ?? "received"]}:{" "}
                {quote.holdReason}. Payment is blocked until the hold is
                released.
              </span>
            </div>
          )}
          {quote.status === "revised" && (
            <div className="flex items-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              Waiting for customer/partner response
              {quote.revisionExpiresAt && (
                <span className="text-muted-foreground">
                  (expires {formatDate(quote.revisionExpiresAt)})
                </span>
              )}
            </div>
          )}
          {quote.status === "returning" && quote.returnReason && (
            <div className="flex items-center gap-2 text-amber-700">
              <Package className="h-4 w-4" />
              Returning: {quote.returnReason}
            </div>
          )}
          {quote.status === "paid" && (
            <div className="flex items-start gap-2 text-emerald-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Quote completed — payment has been made.
                {quote.payout && (
                  <span className="block text-muted-foreground">
                    {formatWithNZD(quote.payout, quote.payout.amountNZD)} to{" "}
                    {payoutDestination(quote.payout)}
                    {quote.payout.paidBy && ` · by ${quote.payout.paidBy}`}
                    {quote.payout.paidAt && ` · ${formatDate(quote.payout.paidAt)}`}
                  </span>
                )}
              </span>
            </div>
          )}
          {quote.status === "cancelled" && (
            <div className="flex items-start gap-2 text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This quote has been cancelled
                {quote.cancelReason &&
                  `: ${CANCEL_REASON_LABELS[quote.cancelReason] ?? quote.cancelReason}`}
                {quote.cancelNote && ` — ${quote.cancelNote}`}
              </span>
            </div>
          )}
          {quote.status === "returned" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              Device has been returned to customer.
              {quote.returnTrackingNumber && (
                <span className="font-mono text-xs">
                  Tracking {quote.returnTrackingNumber}
                </span>
              )}
            </div>
          )}
          {quote.status === "expired" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              This quote has expired.
              {can("received") && " If the device arrives, it can still be received."}
            </div>
          )}
        </div>

        {/* Action buttons (from the transitions this admin may make) */}
        <div className="flex flex-wrap items-center gap-3">
          {can("accepted") && (
            <Button variant="secondary" onClick={openAccept}>
              Mark Accepted
            </Button>
          )}
          {can("shipped") && (
            <Button
              onClick={() => transition("shipped")}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark Shipped
            </Button>
          )}
          {can("received") && quote.status !== "on_hold" && (
            <Button onClick={() => openReceive("received")}>
              Mark Received
            </Button>
          )}
          {quote.status === "received" && (can("inspected") || can("revised")) && (
            <Button onClick={openInspection}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Begin Inspection
            </Button>
          )}
          {quote.status === "on_hold" && quote.heldFrom && can(quote.heldFrom) && (
            <Button
              onClick={() => openReasonDialog("release", quote.heldFrom!)}
            >
              Release Hold
            </Button>
          )}
          {quote.status === "revised" && can("inspected") && (
            <Button
              variant="secondary"
              onClick={() => openReasonDialog("force", "inspected")}
            >
              Force Accept (on behalf of customer)
            </Button>
          )}
          {can("paid") && (
            <Button
              onClick={() => {
                setActionError(null);
                setPayOpen(true);
              }}
            >
              Mark Paid
            </Button>
          )}
          {can("returned") && (
            <Button
              onClick={() => {
                setReturnTracking("");
                setActionError(null);
                setReturnedOpen(true);
              }}
            >
              Mark Returned
            </Button>
          )}
          {can("on_hold") && (
            <Button
              variant="outline"
              onClick={() => openReasonDialog("hold", "on_hold")}
            >
              <PauseCircle className="mr-2 h-4 w-4" />
              Put On Hold
            </Button>
          )}
          {can("returning") && (
            <Button
              variant="outline"
              onClick={() => openReasonDialog("return", "returning")}
            >
              Return Device
            </Button>
          )}
          {can("cancelled") && (
            <Button
              variant="destructive"
              className="ml-auto"
              onClick={openCancel}
            >
              Cancel Quote
            </Button>
          )}
        </div>

        {actionError && (
          <p className="mt-3 text-sm text-destructive">{actionError}</p>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 4b. Status History                                                */}
      {/* ---------------------------------------------------------------- */}
      {quote.statusHistory.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">History</h2>
          </div>
          <ol className="space-y-3 text-sm">
            {[...quote.statusHistory].reverse().map((entry, idx) => (
              <li key={idx} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <span className="shrink-0 text-muted-foreground sm:w-44">
                  {formatDate(entry.at)}
                </span>
                <span>
                  <span className="font-medium">
                    {STATUS_LABELS[entry.from] ?? entry.from} →{" "}
                    {STATUS_LABELS[entry.to] ?? entry.to}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    by {entry.actorId ?? entry.actor}
                  </span>
                  {entry.reason && (
                    <span className="block text-muted-foreground">
                      {entry.reason}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 5. Inspection Dialog                                              */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={inspectionOpen} onOpenChange={setInspectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Device Inspection</DialogTitle>
            <DialogDescription>
              Inspect the device and assign a grade. If it&apos;s worth less
              than quoted, send a revised offer for the customer/partner to
              accept. If it&apos;s as good or better, we pay the original
              quote.{" "}
              <HelpLink page="trade-ins/inspect-device" />
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Device summary */}
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
              <p className="font-medium">{deviceSummary}</p>
              <p className="mt-1 text-muted-foreground">
                Original: Grade {quote.grade} &mdash;{" "}
                {formatWithNZD(originalAmount(quote), quote.quotePriceNZD)}
              </p>
            </div>

            {/* Late arrival decision (D2, terms §5) */}
            {needsLateDecision && (
              <div className="grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Late arrival
                  </p>
                  <HelpLink page="trade-ins/late-arrival" label="How to decide" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Post by {formatDate(quote.postByAt)}. Check the first scan
                  {quote.trackingNumber ? (
                    <>
                      {" "}in{" "}
                      <a
                        href={`https://auspost.com.au/mypost/track/#/details/${encodeURIComponent(quote.trackingNumber)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        AusPost tracking
                      </a>
                    </>
                  ) : null}
                  . Lodged by the post-by date counts as on time; otherwise
                  honour the quote or reassess at current pricing.
                </p>
                <Select
                  value={lateDecision}
                  onValueChange={(val) => setLateDecision(val as LateDecision)}
                >
                  <SelectTrigger id="late-decision">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LATE_DECISIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {LATE_DECISION_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Note, e.g. first scan date (optional)"
                  value={lateDecisionNote}
                  onChange={(e) => setLateDecisionNote(e.target.value)}
                />
              </div>
            )}

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

            {/* Device change toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="change-device"
                checked={changeDevice}
                onChange={(e) => {
                  setChangeDevice(e.target.checked);
                  if (!e.target.checked) setRevisedDevice(null);
                }}
                className="rounded border-input"
              />
              <Label htmlFor="change-device" className="text-sm font-normal">
                Device model/storage is different from quoted
              </Label>
            </div>

            {changeDevice && (
              <DeviceSearchSelect
                value={revisedDevice}
                onChange={setRevisedDevice}
              />
            )}

            {/* Revised price — shown if any mismatch detected */}
            {hasMismatch && (
              <div className="grid gap-2">
                <Label htmlFor="revised-price">
                  Revised Price (NZD)
                </Label>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-xs text-muted-foreground">
                    {gradeChanged && changeDevice && revisedDevice
                      ? `Grade changed from ${quote.grade} to ${inspectionGrade} and device changed.`
                      : gradeChanged
                      ? `Grade changed from ${quote.grade} to ${inspectionGrade}.`
                      : `Device changed from original.`}{" "}
                    A revised offer must be below the original{" "}
                    {quote.quotePriceNZD.toFixed(2)} NZD. If the device is as
                    good or better, confirm at the original quote.
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
                {original && original.currency !== "NZD" && (
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">You enter (NZD)</p>
                      <p className="font-medium">
                        {revisedPrice !== "" && !isNaN(parsedRevisedPrice)
                          ? formatMoney(parsedRevisedPrice, "NZD")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Customer sees ({original.currency}
                        {quote.fxRate ? ` @ ${quote.fxRate.toFixed(4)}` : ""})
                      </p>
                      <p className="font-medium">
                        {revisedCustomerPrice !== null
                          ? formatMoney(revisedCustomerPrice, original.currency)
                          : "—"}
                        <span className="text-muted-foreground">
                          {" "}
                          vs {formatMoney(original.amount, original.currency)}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
                {revisedPrice !== "" && !revisedPriceValid && (
                  <p className="text-xs text-destructive">
                    {!isNaN(parsedRevisedPrice) &&
                    parsedRevisedPrice < quote.quotePriceNZD &&
                    original
                      ? `In ${original.currency} this isn't below the original ${formatMoney(original.amount, original.currency)}. Enter a lower price.`
                      : `Enter a price below ${quote.quotePriceNZD.toFixed(2)} NZD.`}
                  </p>
                )}
              </div>
            )}

            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInspectionOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant={hasMismatch ? "outline" : "default"}
              onClick={() => handleInspection("inspected")}
              disabled={
                !inspectionGrade ||
                actionLoading ||
                lateDecisionMissing ||
                (changeDevice && !revisedDevice)
              }
            >
              {actionLoading && !hasMismatch && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {hasMismatch ? "Confirm at Original Quote" : "Complete Inspection"}
            </Button>
            {hasMismatch && (
              <Button
                onClick={() => handleInspection("revised")}
                disabled={!revisedPriceValid || actionLoading || lateDecisionMissing}
              >
                {actionLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Revised Offer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Mark Paid Dialog                                                  */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              Send the payment first, then mark the quote paid. The customer
              gets a payment email.{" "}
              <HelpLink page="trade-ins/pay-customer" />
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const payable = payableAmount(quote);
            return (
              <dl className="grid gap-2 py-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right font-semibold">
                    {formatMoney(payable.amount, payable.currency)}
                    {payable.currency !== "NZD" && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {formatMoney(payable.amountNZD, "NZD")}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Basis</dt>
                  <dd>{payable.revised ? "Revised offer" : "Original quote"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Pay to</dt>
                  <dd className="text-right">
                    {quote.paymentMethod === "payid"
                      ? `PayID ${quote.payIdPhone ?? ""}`
                      : quote.paymentMethod === "bank_transfer"
                        ? `BSB ${quote.bankBSB ?? ""} · ${quote.bankAccountNumber ?? ""} · ${quote.bankAccountName ?? ""}`
                        : quote.partnerMode === "B"
                          ? "Partner (Mode B)"
                          : "—"}
                  </dd>
                </div>
              </dl>
            );
          })()}
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (await transition("paid")) setPayOpen(false);
              }}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Mark Returned Dialog                                              */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={returnedOpen} onOpenChange={setReturnedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Returned</DialogTitle>
            <DialogDescription>
              Post the device back first. The customer is emailed that
              it&apos;s on its way, with the tracking number if you add one.{" "}
              <HelpLink page="trade-ins/return-device" />
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {quote.shippingAddress && (
              <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">Return to</p>
                <p className="mt-1">{quote.shippingAddress}</p>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="return-tracking">Return tracking number</Label>
              <Input
                id="return-tracking"
                placeholder="Optional"
                className="font-mono"
                value={returnTracking}
                onChange={(e) => setReturnTracking(e.target.value)}
              />
            </div>
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnedOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const ok = await transition("returned", {
                  returnTrackingNumber: returnTracking.trim() || undefined,
                });
                if (ok) setReturnedOpen(false);
              }}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark Returned
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Accept Dialog                                                     */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Accept Quote</DialogTitle>
            <DialogDescription>
              Confirm the customer&apos;s contact and payout details. No email
              is sent for admin acceptances.{" "}
              <HelpLink page="trade-ins/create-and-accept" />
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {(
              [
                ["customerName", "Name"],
                ["customerEmail", "Email"],
                ["customerPhone", "Phone"],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="grid gap-1.5">
                <Label htmlFor={`accept-${field}`}>{label}</Label>
                <Input
                  id={`accept-${field}`}
                  value={acceptForm[field]}
                  onChange={(e) =>
                    setAcceptForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                />
              </div>
            ))}
            <AuAddressFields
              idPrefix="accept-address"
              value={acceptAddress}
              onChange={setAcceptAddress}
              hint={
                !quote.shippingAddressParts && quote.shippingAddress
                  ? `On file: ${quote.shippingAddress}`
                  : undefined
              }
            />
            <div className="grid gap-1.5">
              <Label>
                Payment method
                {quote.partnerMode === "B" && " (optional for Mode B)"}
              </Label>
              <Select
                value={acceptForm.paymentMethod}
                onValueChange={(val) =>
                  setAcceptForm((f) => ({ ...f, paymentMethod: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payid">PayID</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {acceptForm.paymentMethod === "payid" && (
              <div className="grid gap-1.5">
                <Label htmlFor="accept-payid">PayID phone</Label>
                <Input
                  id="accept-payid"
                  value={acceptForm.payIdPhone}
                  onChange={(e) =>
                    setAcceptForm((f) => ({ ...f, payIdPhone: e.target.value }))
                  }
                />
              </div>
            )}
            {acceptForm.paymentMethod === "bank_transfer" &&
              (
                [
                  ["bankBSB", "BSB"],
                  ["bankAccountNumber", "Account number"],
                  ["bankAccountName", "Account name"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="grid gap-1.5">
                  <Label htmlFor={`accept-${field}`}>{label}</Label>
                  <Input
                    id={`accept-${field}`}
                    value={acceptForm[field]}
                    onChange={(e) =>
                      setAcceptForm((f) => ({ ...f, [field]: e.target.value }))
                    }
                  />
                </div>
              ))}
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcceptOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAccept}
              disabled={actionLoading || !isAuAddressComplete(acceptAddress)}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Receive Dialog                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Dialog
        open={receiveTarget !== null}
        onOpenChange={(open) => !open && setReceiveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Device</DialogTitle>
            <DialogDescription>
              Enter the IMEI or serial number of the device in the parcel.{" "}
              <HelpLink page="trade-ins/receive-parcel" />
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
              <p className="font-medium">{deviceSummary}</p>
              <p className="mt-1 text-muted-foreground">
                {quote.customerName ?? "No customer name"}
                {quote.imei && ` · Quoted IMEI ${quote.imei}`}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="receive-imei">IMEI</Label>
              <Input
                id="receive-imei"
                value={receiveImei}
                inputMode="numeric"
                maxLength={15}
                onChange={(e) =>
                  setReceiveImei(e.target.value.replace(/\D/g, "").slice(0, 15))
                }
              />
              {quote.imei &&
                receiveImei.length === 15 &&
                receiveImei !== quote.imei && (
                  <p className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    Doesn&apos;t match the IMEI on the quote ({quote.imei}).
                  </p>
                )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="receive-serial">Serial number (if no IMEI)</Label>
              <Input
                id="receive-serial"
                value={receiveSerial}
                onChange={(e) => setReceiveSerial(e.target.value)}
              />
            </div>
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiveTarget(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReceive}
              disabled={
                actionLoading ||
                (receiveImei.length !== 15 && !receiveSerial.trim())
              }
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark Received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Reason Dialog (hold / release / return / force accept)            */}
      {/* ---------------------------------------------------------------- */}
      <Dialog
        open={reasonDialog !== null}
        onOpenChange={(open) => !open && setReasonDialog(null)}
      >
        {reasonDialog && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{REASON_DIALOGS[reasonDialog.kind].title}</DialogTitle>
              <DialogDescription>
                {REASON_DIALOGS[reasonDialog.kind].description}{" "}
                <HelpLink page={REASON_DIALOGS[reasonDialog.kind].help} />
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="reason-text">
                {REASON_DIALOGS[reasonDialog.kind].label}
              </Label>
              <Textarea
                id="reason-text"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
              />
              {actionError && (
                <p className="text-sm text-destructive">{actionError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setReasonDialog(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReasonSubmit}
                disabled={actionLoading || !reasonText.trim()}
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {REASON_DIALOGS[reasonDialog.kind].submit}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Cancel Dialog                                                     */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Quote</DialogTitle>
            <DialogDescription>
              Cancel this quote for{" "}
              <span className="font-semibold">{deviceSummary}</span>? This
              can&apos;t be undone and no email is sent to the customer.{" "}
              <HelpLink page="trade-ins/cancel" />
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Reason</Label>
              <Select
                value={cancelReason}
                onValueChange={(val) => setCancelReason(val as CancelReason)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {CANCEL_REASONS.filter((r) =>
                    quote.status === "on_hold"
                      ? r === "surrendered"
                      : r !== "surrendered"
                  ).map((r) => (
                    <SelectItem key={r} value={r}>
                      {CANCEL_REASON_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cancel-note">
                Note{cancelReason === "other" ? "" : " (optional)"}
              </Label>
              <Textarea
                id="cancel-note"
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
              />
            </div>
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={actionLoading}
            >
              Keep Quote
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={
                actionLoading ||
                !cancelReason ||
                (cancelReason === "other" && !cancelNote.trim())
              }
            >
              {actionLoading && (
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
