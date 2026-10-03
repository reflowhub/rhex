"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Pencil,
  Users,
  DollarSign,
  Link2,
  Package,
  CreditCard,
  User,
  KeyRound,
  Copy,
  Check,
  Code2,
  Trash2,
  Key,
} from "lucide-react";
import { useFX } from "@/lib/use-fx";
import {
  CUSTOMER_EMAIL_SWITCHES,
  DEFAULT_SUPPORT_EMAIL,
  REFLOW_LABELS,
  customerEmailSwitches,
  type CustomerEmailSwitch,
  type EmailBrandSettings,
  type LabelArrangement,
  type LabelDirection,
  type LabelParty,
} from "@/lib/partner-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Partner {
  id: string;
  name: string;
  code: string;
  contactEmail: string;
  modes: string[];
  status: string;
  authUid: string | null;
  commissionModel: string | null;
  commissionPercent: number | null;
  commissionFlat: number | null;
  commissionTiers: { minQty: number; rate: number }[] | null;
  payoutFrequency: string | null;
  partnerRateDiscount: number | null;
  apiMode: "B" | "C" | null;
  resultWebhook: {
    url: string | null;
    sandboxUrl: string | null;
    secretEnv: string | null;
    sandboxSecretEnv: string | null;
    secretSet: boolean;
    sandboxSecretSet: boolean;
  };
  sandboxEmailAllowlist: string[];
  sandboxEmailFallback: string | null;
  emailBrand: EmailBrandSettings;
  customerEmails: Record<CustomerEmailSwitch, boolean>;
  neverArrivedResult?: boolean;
  labels?: LabelArrangement;
  currency: "AUD" | "NZD";
  contactPerson: string | null;
  contactPhone: string | null;
  address: string | null;
  companyName: string | null;
  companyRegistrationNumber: string | null;
  widgetEnabled: boolean;
  widgetPrimaryColor: string | null;
  widgetLogoUrl: string | null;
  widgetCustomHeading: string | null;
  paymentMethod: string | null;
  payIdPhone: string | null;
  bankBSB: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  commissionSummary: {
    totalPending: number;
    totalPaid: number;
    entryCount: number;
  } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PayoutItem {
  id: string;
  amount: number;
  reference: string | null;
  paymentMethod: string | null;
  ledgerEntryCount: number;
  createdAt: string | null;
}

interface ApiKey {
  id: string;
  keyPrefix: string;
  label: string;
  sandbox: boolean;
  status: "active" | "revoked";
  createdAt: string | null;
  lastUsedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LABEL_DIRECTION_NAMES: Record<LabelDirection, string> = {
  inbound: "Inbound labels",
  return: "Return labels",
};

/** "Made by partner, paid by Reflow (partner charges Reflow)" */
function describeLabelTerms(labels: LabelArrangement, direction: LabelDirection): string {
  const { providedBy, paidBy } = labels[direction];
  const who = (p: LabelParty) => (p === "reflow" ? "Reflow" : "partner");
  if (providedBy === paidBy) return `Made and paid by ${who(providedBy)}`;
  return `Made by ${who(providedBy)}, paid by ${who(paidBy)} (${who(providedBy)} charges ${who(paidBy)})`;
}

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formatPrice: fxFormatPrice } = useFX();

  // ---- data state
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- payouts state
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // ---- reset password dialog
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwError, setResetPwError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ---- edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    contactEmail: "",
    status: "active",
    currency: "AUD" as "AUD" | "NZD",
    modeA: false,
    modeB: false,
    modeC: false,
    resultUrl: "",
    resultSandboxUrl: "",
    resultSecretEnv: "",
    resultSandboxSecretEnv: "",
    sandboxEmailAllowlist: "",
    sandboxEmailFallback: "",
    emailDisplayName: "",
    emailLogoUrl: "",
    emailSupportEmail: "",
    emailSupportPhone: "",
    customerEmails: customerEmailSwitches(undefined),
    neverArrivedResult: true,
    labels: REFLOW_LABELS,
    commissionModel: "percentage",
    commissionPercent: 5,
    commissionFlat: 5,
    partnerRateDiscount: 10,
    payoutFrequency: "monthly",
    contactPerson: "",
    contactPhone: "",
    address: "",
    companyName: "",
    companyRegistrationNumber: "",
    widgetEnabled: false,
    widgetPrimaryColor: "",
    widgetLogoUrl: "",
    widgetCustomHeading: "",
  });

  // ---- api keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [generateKeyOpen, setGenerateKeyOpen] = useState(false);
  const [generateKeyLoading, setGenerateKeyLoading] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeySandbox, setNewKeySandbox] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);
  const [revokeKeyLoading, setRevokeKeyLoading] = useState(false);

  // ---- fetch partner
  const fetchPartner = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/partners/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Partner not found");
        return res.json();
      })
      .then((data: Partner) => setPartner(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchPartner();
  }, [fetchPartner]);

  // ---- fetch payouts
  const fetchPayouts = useCallback(() => {
    if (!id) return;
    setPayoutsLoading(true);
    fetch(`/api/admin/partners/${id}/payouts`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPayouts(data);
      })
      .catch(console.error)
      .finally(() => setPayoutsLoading(false));
  }, [id]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  // ---- fetch api keys
  const fetchApiKeys = useCallback(() => {
    if (!id) return;
    setApiKeysLoading(true);
    fetch(`/api/admin/partners/${id}/api-keys`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setApiKeys(data);
      })
      .catch(console.error)
      .finally(() => setApiKeysLoading(false));
  }, [id]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  // ---- generate api key
  const handleGenerateApiKey = async () => {
    setGenerateKeyLoading(true);
    try {
      const res = await fetch(`/api/admin/partners/${id}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newKeyLabel.trim() || "Default", sandbox: newKeySandbox }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setGeneratedApiKey(data.key);
      fetchApiKeys();
    } catch {
      // silently fail
    } finally {
      setGenerateKeyLoading(false);
    }
  };

  // ---- revoke api key
  const handleRevokeApiKey = async () => {
    if (!revokeKeyId) return;
    setRevokeKeyLoading(true);
    try {
      await fetch(`/api/admin/partners/${id}/api-keys/${revokeKeyId}`, {
        method: "DELETE",
      });
      setRevokeKeyId(null);
      fetchApiKeys();
    } catch {
      // silently fail
    } finally {
      setRevokeKeyLoading(false);
    }
  };

  const copyApiKey = () => {
    if (!generatedApiKey) return;
    navigator.clipboard.writeText(generatedApiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  // ---- create payout
  const handleCreatePayout = async () => {
    setPayoutLoading(true);
    setPayoutError(null);
    try {
      const res = await fetch(`/api/admin/partners/${id}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: payoutReference.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        setPayoutError(err.error || "Failed to create payout");
        return;
      }
      setPayoutDialogOpen(false);
      setPayoutReference("");
      fetchPartner();
      fetchPayouts();
    } catch {
      setPayoutError("Failed to create payout");
    } finally {
      setPayoutLoading(false);
    }
  };

  // ---- reset password
  const handleResetPassword = async () => {
    setResetPwLoading(true);
    setResetPwError(null);
    try {
      const res = await fetch(`/api/admin/partners/${id}/reset-password`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        setResetPwError(err.error || "Failed to reset password");
        return;
      }
      const data = await res.json();
      setGeneratedPassword(data.password);
    } catch {
      setResetPwError("Failed to reset password");
    } finally {
      setResetPwLoading(false);
    }
  };

  const copyPassword = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---- open edit dialog with current values
  const openEdit = () => {
    if (!partner) return;
    setEditForm({
      name: partner.name,
      code: partner.code,
      contactEmail: partner.contactEmail,
      status: partner.status,
      currency: partner.currency ?? "AUD",
      modeA: partner.modes.includes("A"),
      modeB: partner.modes.includes("B"),
      modeC: partner.modes.includes("C"),
      resultUrl: partner.resultWebhook?.url ?? "",
      resultSandboxUrl: partner.resultWebhook?.sandboxUrl ?? "",
      resultSecretEnv: partner.resultWebhook?.secretEnv ?? "",
      resultSandboxSecretEnv: partner.resultWebhook?.sandboxSecretEnv ?? "",
      sandboxEmailAllowlist: (partner.sandboxEmailAllowlist ?? []).join("\n"),
      sandboxEmailFallback: partner.sandboxEmailFallback ?? "",
      emailDisplayName: partner.emailBrand?.displayName ?? "",
      emailLogoUrl: partner.emailBrand?.logoUrl ?? "",
      emailSupportEmail: partner.emailBrand?.supportEmail ?? "",
      emailSupportPhone: partner.emailBrand?.supportPhone ?? "",
      customerEmails: partner.customerEmails ?? customerEmailSwitches(undefined),
      neverArrivedResult: partner.neverArrivedResult ?? true,
      labels: partner.labels ?? REFLOW_LABELS,
      commissionModel: partner.commissionModel || "percentage",
      commissionPercent: partner.commissionPercent ?? 5,
      commissionFlat: partner.commissionFlat ?? 5,
      partnerRateDiscount:
        partner.partnerRateDiscount ?? (partner.modes.includes("C") ? 0 : 10),
      payoutFrequency: partner.payoutFrequency || "monthly",
      contactPerson: partner.contactPerson ?? "",
      contactPhone: partner.contactPhone ?? "",
      address: partner.address ?? "",
      companyName: partner.companyName ?? "",
      companyRegistrationNumber: partner.companyRegistrationNumber ?? "",
      widgetEnabled: partner.widgetEnabled ?? false,
      widgetPrimaryColor: partner.widgetPrimaryColor ?? "",
      widgetLogoUrl: partner.widgetLogoUrl ?? "",
      widgetCustomHeading: partner.widgetCustomHeading ?? "",
    });
    setEditError(null);
    setEditOpen(true);
  };

  // ---- save edit
  const handleSave = async () => {
    if (!partner) return;
    setEditLoading(true);
    setEditError(null);

    const modes: string[] = [];
    if (editForm.modeA) modes.push("A");
    if (editForm.modeB) modes.push("B");
    if (editForm.modeC) modes.push("C");

    if (modes.length === 0) {
      setEditError("At least one mode is required");
      setEditLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          code: editForm.code.trim(),
          contactEmail: editForm.contactEmail.trim(),
          status: editForm.status,
          currency: editForm.currency,
          modes,
          commissionModel: editForm.commissionModel,
          commissionPercent: editForm.commissionPercent,
          commissionFlat: editForm.commissionFlat,
          partnerRateDiscount: editForm.partnerRateDiscount,
          // API quotes take Mode C when the partner has it
          apiMode: editForm.modeC ? "C" : editForm.modeB ? "B" : null,
          ...(editForm.modeC && {
            resultWebhook: {
              url: editForm.resultUrl.trim() || null,
              sandboxUrl: editForm.resultSandboxUrl.trim() || null,
              secretEnv: editForm.resultSecretEnv.trim() || null,
              sandboxSecretEnv: editForm.resultSandboxSecretEnv.trim() || null,
            },
            sandboxEmailAllowlist: editForm.sandboxEmailAllowlist,
            sandboxEmailFallback: editForm.sandboxEmailFallback.trim() || null,
            emailBrand: {
              displayName: editForm.emailDisplayName,
              logoUrl: editForm.emailLogoUrl,
              supportEmail: editForm.emailSupportEmail,
              supportPhone: editForm.emailSupportPhone,
            },
            customerEmails: editForm.customerEmails,
            neverArrivedResult: editForm.neverArrivedResult,
            labels: editForm.labels,
          }),
          payoutFrequency: editForm.payoutFrequency,
          contactPerson: editForm.contactPerson.trim() || null,
          contactPhone: editForm.contactPhone.trim() || null,
          address: editForm.address.trim() || null,
          companyName: editForm.companyName.trim() || null,
          companyRegistrationNumber: editForm.companyRegistrationNumber.trim() || null,
          widgetEnabled: editForm.widgetEnabled,
          widgetPrimaryColor: editForm.widgetPrimaryColor.trim() || null,
          widgetLogoUrl: editForm.widgetLogoUrl.trim() || null,
          widgetCustomHeading: editForm.widgetCustomHeading.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setEditError(err.error || "Failed to update partner");
        return;
      }

      setEditOpen(false);
      fetchPartner();
    } catch {
      setEditError("Failed to update partner");
    } finally {
      setEditLoading(false);
    }
  };

  // ---- render: loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading partner...
        </span>
      </div>
    );
  }

  // ---- render: error / not found
  if (error || !partner) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {error ?? "Partner not found."}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/partners")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Partners
        </Button>
      </div>
    );
  }

  // ---- render: main
  return (
    <div>
      {/* Header */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/partners")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Partners
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{partner.name}</h1>
          <Badge
            variant={partner.status === "active" ? "default" : "secondary"}
            className={
              partner.status === "active"
                ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80"
                : ""
            }
          >
            {partner.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {partner.authUid && (
            <Button
              variant="outline"
              onClick={() => {
                setGeneratedPassword(null);
                setResetPwError(null);
                setCopied(false);
                setResetPwOpen(true);
              }}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Reset Password
            </Button>
          )}
          <Button variant="outline" onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Partner Details Card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Partner Details</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Code</dt>
              <dd className="font-mono font-medium">{partner.code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                <a
                  href={`mailto:${partner.contactEmail}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {partner.contactEmail}
                </a>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="font-medium">{partner.currency ?? "AUD"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mode(s)</dt>
              <dd className="flex gap-1">
                {partner.modes.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs">
                    {m === "A" ? "Referral" : m === "B" ? "Dealer" : "Retailer (C)"}
                  </Badge>
                ))}
              </dd>
            </div>
            <div className="my-1 h-px bg-border" />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(partner.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{formatDate(partner.updatedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Auth Account</dt>
              <dd className="text-xs">
                {partner.authUid ? (
                  <Badge variant="outline" className="text-xs">
                    Linked
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">Not linked</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Commission / Rate Config Card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Pricing & Commission</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            {/* Mode A config */}
            {partner.modes.includes("A") && (
              <>
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Mode A — Referral Commission</span>
                </div>
                <div className="flex justify-between pl-6">
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="font-medium capitalize">
                    {partner.commissionModel || "percentage"}
                  </dd>
                </div>
                {partner.commissionModel === "percentage" && (
                  <div className="flex justify-between pl-6">
                    <dt className="text-muted-foreground">Rate</dt>
                    <dd className="font-medium">
                      {partner.commissionPercent ?? 5}%
                    </dd>
                  </div>
                )}
                {partner.commissionModel === "flat" && (
                  <div className="flex justify-between pl-6">
                    <dt className="text-muted-foreground">Flat Fee</dt>
                    <dd className="font-medium">
                      ${partner.commissionFlat ?? 0} / device
                    </dd>
                  </div>
                )}
                {partner.commissionModel === "tiered" &&
                  partner.commissionTiers && (
                    <div className="pl-6">
                      <dt className="mb-1 text-muted-foreground">Tiers</dt>
                      <dd>
                        {partner.commissionTiers.map((tier, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-xs"
                          >
                            <span>{tier.minQty}+ devices/month</span>
                            <span className="font-medium">{tier.rate}%</span>
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}
                <div className="flex justify-between pl-6">
                  <dt className="text-muted-foreground">Payout Frequency</dt>
                  <dd className="font-medium capitalize">
                    {partner.payoutFrequency || "monthly"}
                  </dd>
                </div>
              </>
            )}

            {partner.modes.includes("A") && partner.modes.includes("B") && (
              <div className="my-1 h-px bg-border" />
            )}

            {/* Mode B config */}
            {partner.modes.includes("B") && (
              <>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Mode B — Partner Rate</span>
                </div>
                <div className="flex justify-between pl-6">
                  <dt className="text-muted-foreground">Rate Discount</dt>
                  <dd className="font-medium">
                    {partner.partnerRateDiscount ?? 10}% below public payout
                  </dd>
                </div>
                <div className="flex justify-between pl-6">
                  <dt className="text-muted-foreground">Partner Receives</dt>
                  <dd className="font-medium">
                    {100 - (partner.partnerRateDiscount ?? 10)}% of public payout
                  </dd>
                </div>
              </>
            )}

            {/* Mode C config */}
            {partner.modes.includes("C") && (
              <>
                {(partner.modes.includes("A") || partner.modes.includes("B")) && (
                  <div className="my-1 h-px bg-border" />
                )}
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Mode C — Retailer Trade-In</span>
                </div>
                <div className="flex justify-between pl-6">
                  <dt className="text-muted-foreground">API price</dt>
                  <dd className="font-medium">
                    {(partner.partnerRateDiscount ?? 0) === 0
                      ? "Public price"
                      : `${partner.partnerRateDiscount}% below public price`}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 pl-6">
                  <dt className="shrink-0 text-muted-foreground">Result URL</dt>
                  <dd className="truncate text-xs">
                    {partner.resultWebhook?.url ?? "Not set"}
                    {partner.resultWebhook?.url && !partner.resultWebhook.secretSet && (
                      <span className="ml-1 text-destructive">(secret missing)</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 pl-6">
                  <dt className="shrink-0 text-muted-foreground">Sandbox result URL</dt>
                  <dd className="truncate text-xs">
                    {partner.resultWebhook?.sandboxUrl ?? "Not set"}
                    {partner.resultWebhook?.sandboxUrl &&
                      !partner.resultWebhook.sandboxSecretSet && (
                        <span className="ml-1 text-destructive">(secret missing)</span>
                      )}
                  </dd>
                </div>
                {(["inbound", "return"] as const).map((direction) => (
                  <div key={direction} className="flex justify-between gap-4 pl-6">
                    <dt className="shrink-0 text-muted-foreground">
                      {LABEL_DIRECTION_NAMES[direction]}
                    </dt>
                    <dd className="text-right text-xs">
                      {describeLabelTerms(partner.labels ?? REFLOW_LABELS, direction)}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 pl-6">
                  <dt className="shrink-0 text-muted-foreground">Never arrived</dt>
                  <dd className="text-right text-xs">
                    {partner.neverArrivedResult === false
                      ? "Sends nothing"
                      : "Sends accepted: false (original price and grade)"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 pl-6">
                  <dt className="shrink-0 text-muted-foreground">Sandbox emails</dt>
                  <dd className="text-right text-xs">
                    {(partner.sandboxEmailAllowlist ?? []).join(", ") || "None allowed"}
                    <br />
                    <span className="text-muted-foreground">
                      Others → {partner.sandboxEmailFallback ?? "dropped"}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4 pl-6">
                  <dt className="shrink-0 text-muted-foreground">Customer emails</dt>
                  <dd className="text-right text-xs">
                    {partner.emailBrand?.displayName || partner.name}
                    {partner.emailBrand?.logoUrl ? " (logo set)" : " (no logo)"}
                    <br />
                    <span className="text-muted-foreground">
                      Support {partner.emailBrand?.supportEmail ?? DEFAULT_SUPPORT_EMAIL}
                      {partner.emailBrand?.supportPhone && `, ${partner.emailBrand.supportPhone}`}
                    </span>
                    <br />
                    <span className="text-muted-foreground">
                      {(() => {
                        const off = CUSTOMER_EMAIL_SWITCHES.filter(
                          (e) => partner.customerEmails?.[e.key] === false
                        );
                        return off.length === 0
                          ? "All on"
                          : `Off: ${off.map((e) => e.label).join(", ")}`;
                      })()}
                    </span>
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>

        {/* Commission Summary Card (Mode A) */}
        {partner.commissionSummary && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Commission Summary</h2>
            </div>

            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Entries</dt>
                <dd className="font-medium">
                  {partner.commissionSummary.entryCount}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pending Payout</dt>
                <dd className="font-medium text-amber-600">
                  {fxFormatPrice(partner.commissionSummary.totalPending, partner.currency ?? "AUD")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Paid</dt>
                <dd className="font-medium text-emerald-600">
                  {fxFormatPrice(partner.commissionSummary.totalPaid, partner.currency ?? "AUD")}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Payment Details Card */}
        {partner.paymentMethod && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Payment Details</h2>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Method</dt>
                <dd className="font-medium">
                  {partner.paymentMethod === "payid"
                    ? "PayID"
                    : "Bank Transfer"}
                </dd>
              </div>
              {partner.paymentMethod === "payid" && partner.payIdPhone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">PayID Phone</dt>
                  <dd className="font-mono text-xs">{partner.payIdPhone}</dd>
                </div>
              )}
              {partner.paymentMethod === "bank_transfer" && (
                <>
                  {partner.bankAccountName && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Account Name</dt>
                      <dd>{partner.bankAccountName}</dd>
                    </div>
                  )}
                  {partner.bankBSB && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">BSB</dt>
                      <dd className="font-mono text-xs">{partner.bankBSB}</dd>
                    </div>
                  )}
                  {partner.bankAccountNumber && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Account Number</dt>
                      <dd className="font-mono text-xs">
                        {partner.bankAccountNumber}
                      </dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </div>
        )}

        {/* Contact Details Card */}
        {(partner.companyName || partner.companyRegistrationNumber || partner.contactPerson || partner.contactPhone || partner.address) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Contact Details</h2>
            </div>

            <dl className="grid gap-3 text-sm">
              {partner.companyName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Company</dt>
                  <dd className="font-medium">{partner.companyName}</dd>
                </div>
              )}
              {partner.companyRegistrationNumber && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Registration No.</dt>
                  <dd className="font-mono text-xs">{partner.companyRegistrationNumber}</dd>
                </div>
              )}
              {partner.contactPerson && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Contact Person</dt>
                  <dd>{partner.contactPerson}</dd>
                </div>
              )}
              {partner.contactPhone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{partner.contactPhone}</dd>
                </div>
              )}
              {partner.address && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="text-right max-w-[200px]">{partner.address}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
        {/* Embed Widget Card */}
        {partner.modes.includes("A") && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Code2 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Embed Widget</h2>
            </div>

            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={partner.widgetEnabled ? "default" : "secondary"}>
                    {partner.widgetEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </dd>
              </div>
              {partner.widgetPrimaryColor && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Primary Color</dt>
                  <dd className="flex items-center gap-2">
                    <div
                      className="h-5 w-5 rounded border"
                      style={{ backgroundColor: partner.widgetPrimaryColor }}
                    />
                    <span className="font-mono text-xs">{partner.widgetPrimaryColor}</span>
                  </dd>
                </div>
              )}
              {partner.widgetLogoUrl && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Logo</dt>
                  <dd className="text-xs text-right max-w-[200px] truncate">{partner.widgetLogoUrl}</dd>
                </div>
              )}
              {partner.widgetCustomHeading && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Custom Heading</dt>
                  <dd className="text-right max-w-[200px]">{partner.widgetCustomHeading}</dd>
                </div>
              )}
            </dl>

            {partner.widgetEnabled && (
              <div className="mt-4 space-y-2">
                <Label className="text-muted-foreground">Embed Code</Label>
                <div className="relative">
                  <pre className="rounded-lg bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {`<iframe src="https://rhex.app/embed/${partner.code}" width="100%" height="700" frameborder="0" style="border:none; max-width:500px;"></iframe>`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `<iframe src="https://rhex.app/embed/${partner.code}" width="100%" height="700" frameborder="0" style="border:none; max-width:500px;"></iframe>`
                      );
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* API Access Card */}
        {(partner.modes.includes("B") || partner.modes.includes("C")) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">API Access</h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNewKeyLabel("");
                  setNewKeySandbox(false);
                  setGeneratedApiKey(null);
                  setApiKeyCopied(false);
                  setGenerateKeyOpen(true);
                }}
              >
                <Key className="mr-1 h-3 w-3" />
                Generate Key
              </Button>
            </div>

            {apiKeysLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No API keys generated yet.
              </p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs shrink-0">
                        {key.keyPrefix}...
                      </span>
                      <span className="text-muted-foreground truncate">
                        {key.label}
                      </span>
                      {key.sandbox && (
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0 border-amber-500 text-amber-600"
                        >
                          sandbox
                        </Badge>
                      )}
                      <Badge
                        variant={key.status === "active" ? "default" : "secondary"}
                        className="text-xs shrink-0"
                      >
                        {key.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {key.lastUsedAt && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          Used {formatDate(key.lastUsedAt)}
                        </span>
                      )}
                      {key.status === "active" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setRevokeKeyId(key.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payouts Section (Mode A) */}
      {partner.modes.includes("A") && (
        <div className="mt-6 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Payouts</span>
              <Badge variant="secondary" className="text-xs">
                {payouts.length}
              </Badge>
            </div>
            {partner.commissionSummary &&
              partner.commissionSummary.totalPending > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    setPayoutReference("");
                    setPayoutError(null);
                    setPayoutDialogOpen(true);
                  }}
                >
                  <DollarSign className="mr-1 h-3 w-3" />
                  Create Payout ({fxFormatPrice(
                    partner.commissionSummary.totalPending, partner.currency ?? "AUD"
                  )})
                </Button>
              )}
          </div>

          {payoutsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No payouts yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-xs">
                      {payout.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {fxFormatPrice(payout.amount, partner.currency ?? "AUD")}
                    </TableCell>
                    <TableCell>{payout.ledgerEntryCount} entries</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payout.reference || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(payout.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Create Payout Dialog */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payout</DialogTitle>
            <DialogDescription>
              This will mark all pending commission entries as paid and create a
              payout record for{" "}
              {partner.commissionSummary
                ? fxFormatPrice(partner.commissionSummary.totalPending, partner.currency ?? "AUD")
                : "$0.00"}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {payoutError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {payoutError}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="payout-ref">
                Payment Reference (optional)
              </Label>
              <Input
                id="payout-ref"
                placeholder="e.g. bank transfer ref"
                value={payoutReference}
                onChange={(e) => setPayoutReference(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayoutDialogOpen(false)}
              disabled={payoutLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePayout} disabled={payoutLoading}>
              {payoutLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Partner Password</DialogTitle>
            <DialogDescription>
              {generatedPassword
                ? "Password has been reset. Copy it and share it with the partner securely."
                : `Generate a new temporary password for ${partner.name}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {resetPwError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {resetPwError}
              </div>
            )}

            {generatedPassword && (
              <div className="space-y-2">
                <Label>Temporary Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedPassword}
                    className="font-mono text-base"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyPassword}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The partner should change this password after logging in.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetPwOpen(false)}
            >
              {generatedPassword ? "Close" : "Cancel"}
            </Button>
            {!generatedPassword && (
              <Button
                onClick={handleResetPassword}
                disabled={resetPwLoading}
              >
                {resetPwLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Generate Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {editError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {editError}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="edit-name">Partner Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-code">Partner Code</Label>
              <Input
                id="edit-code"
                value={editForm.code}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  }))
                }
                className="font-mono"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-email">Contact Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.contactEmail}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    contactEmail: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Display Currency</Label>
              <Select
                value={editForm.currency}
                onValueChange={(val) =>
                  setEditForm((f) => ({ ...f, currency: val as "AUD" | "NZD" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUD">AUD (Australian Dollar)</SelectItem>
                  <SelectItem value="NZD">NZD (New Zealand Dollar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Mode(s)</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.modeA}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, modeA: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  Mode A (Referral)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.modeB}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, modeB: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  Mode B (Dealer)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.modeC}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, modeC: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  Mode C (Retailer)
                </label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(val) =>
                  setEditForm((f) => ({ ...f, status: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editForm.modeA && (
              <div className="rounded-md border border-border p-4 space-y-3">
                <p className="text-sm font-medium">Mode A — Commission</p>
                <div className="grid gap-2">
                  <Label>Model</Label>
                  <Select
                    value={editForm.commissionModel}
                    onValueChange={(val) =>
                      setEditForm((f) => ({ ...f, commissionModel: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Flat Fee</SelectItem>
                      <SelectItem value="tiered">Tiered Volume</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editForm.commissionModel === "percentage" && (
                  <div className="grid gap-2">
                    <Label>Rate (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={editForm.commissionPercent}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          commissionPercent: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                )}
                {editForm.commissionModel === "flat" && (
                  <div className="grid gap-2">
                    <Label>Flat Fee ($/device)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editForm.commissionFlat}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          commissionFlat: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Payout Frequency</Label>
                  <Select
                    value={editForm.payoutFrequency}
                    onValueChange={(val) =>
                      setEditForm((f) => ({ ...f, payoutFrequency: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {(editForm.modeB || editForm.modeC) && (
              <div className="rounded-md border border-border p-4 space-y-3">
                <p className="text-sm font-medium">Partner Rate (API quotes)</p>
                <div className="grid gap-2">
                  <Label>Rate Discount (% below public payout; 0 = public price)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={editForm.partnerRateDiscount}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        partnerRateDiscount: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {editForm.modeC && (
              <div className="rounded-md border border-border p-4 space-y-3">
                <p className="text-sm font-medium">Mode C — Result Notifications</p>
                <p className="text-xs text-muted-foreground">
                  URLs must contain {"{quoteId}"}. Secrets stay in env vars; enter
                  the env var names here.
                </p>
                <div className="grid gap-2">
                  <Label>Result URL (production)</Label>
                  <Input
                    placeholder="https://partner.example/api/trade-in/{quoteId}"
                    value={editForm.resultUrl}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, resultUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Secret env var (production)</Label>
                  <Input
                    placeholder="TRADE_IN_WEBHOOK_SECRET"
                    value={editForm.resultSecretEnv}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, resultSecretEnv: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Result URL (sandbox / staging)</Label>
                  <Input
                    placeholder="https://staging.partner.example/api/trade-in/{quoteId}"
                    value={editForm.resultSandboxUrl}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, resultSandboxUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Secret env var (sandbox)</Label>
                  <Input
                    placeholder="TRADE_IN_WEBHOOK_SECRET_SANDBOX"
                    value={editForm.resultSandboxSecretEnv}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        resultSandboxSecretEnv: e.target.value,
                      }))
                    }
                  />
                </div>
                <p className="pt-2 text-sm font-medium">Sandbox emails</p>
                <div className="grid gap-2">
                  <Label>Allowed addresses (one per line)</Label>
                  <textarea
                    rows={3}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={editForm.sandboxEmailAllowlist}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        sandboxEmailAllowlist: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Send all other sandbox emails to</Label>
                  <Input
                    placeholder="test inbox (blank = don't send)"
                    value={editForm.sandboxEmailFallback}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        sandboxEmailFallback: e.target.value,
                      }))
                    }
                  />
                </div>
                <p className="pt-2 text-sm font-medium">Shipping labels</p>
                <p className="text-xs text-muted-foreground">
                  Who makes each label and who pays for it. A label made by
                  one side and paid by the other becomes a settlement line.
                  Trade-ins keep the setting they were accepted under.
                </p>
                {(["inbound", "return"] as const).map((direction) => (
                  <div key={direction} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2 text-sm">
                    <span>{LABEL_DIRECTION_NAMES[direction]}</span>
                    {(["providedBy", "paidBy"] as const).map((role) => (
                      <Select
                        key={role}
                        value={editForm.labels[direction][role]}
                        onValueChange={(val) =>
                          setEditForm((f) => ({
                            ...f,
                            labels: {
                              ...f.labels,
                              [direction]: { ...f.labels[direction], [role]: val as LabelParty },
                            },
                          }))
                        }
                      >
                        <SelectTrigger aria-label={`${LABEL_DIRECTION_NAMES[direction]} ${role === "providedBy" ? "made by" : "paid by"}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reflow">
                            {role === "providedBy" ? "Made by Reflow" : "Paid by Reflow"}
                          </SelectItem>
                          <SelectItem value="partner">
                            {role === "providedBy" ? "Made by partner" : "Paid by partner"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ))}
                  </div>
                ))}
                <p className="pt-2 text-sm font-medium">Never arrived</p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.neverArrivedResult}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, neverArrivedResult: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <span>
                    Send a result when the device never arrives
                    <span className="block text-xs text-muted-foreground">
                      When an accepted trade-in expires unposted, is cancelled
                      before the device arrives, or is lost in transit, send
                      accepted: false with the original price and grade. A
                      device that turns up afterwards can&apos;t be received
                      against it. Trade-ins that were never accepted send
                      nothing.
                    </span>
                  </span>
                </label>
                <p className="pt-2 text-sm font-medium">Customer emails</p>
                <p className="text-xs text-muted-foreground">
                  Co-branded with the partner&apos;s logo, from rhex. Replies go to
                  the support email. Read each time an email is sent.
                </p>
                <div className="grid gap-2">
                  <Label>Display name</Label>
                  <Input
                    placeholder={editForm.name || "Partner name"}
                    value={editForm.emailDisplayName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, emailDisplayName: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Logo URL (https PNG)</Label>
                  <Input
                    placeholder="https://cdn.example.com/logo.png"
                    value={editForm.emailLogoUrl}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, emailLogoUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Support email</Label>
                  <Input
                    placeholder={DEFAULT_SUPPORT_EMAIL}
                    value={editForm.emailSupportEmail}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, emailSupportEmail: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Support phone (optional)</Label>
                  <Input
                    value={editForm.emailSupportPhone}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, emailSupportPhone: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Emails RHEX sends</Label>
                  {CUSTOMER_EMAIL_SWITCHES.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.customerEmails[key]}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            customerEmails: {
                              ...f.customerEmails,
                              [key]: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      {label}
                    </label>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Re-quote emails and the re-quote reminder always go: only RHEX
                    can send them.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-md border border-border p-4 space-y-3">
              <p className="text-sm font-medium">Contact Details</p>
              <div className="grid gap-2">
                <Label>Company Name</Label>
                <Input
                  value={editForm.companyName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, companyName: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Company Registration Number</Label>
                <Input
                  value={editForm.companyRegistrationNumber}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, companyRegistrationNumber: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Contact Person</Label>
                <Input
                  value={editForm.contactPerson}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, contactPerson: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Contact Phone</Label>
                <Input
                  value={editForm.contactPhone}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, contactPhone: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Address</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
            </div>

            {editForm.modeA && (
              <div className="rounded-md border border-border p-4 space-y-3">
                <p className="text-sm font-medium">Embed Widget</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.widgetEnabled}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, widgetEnabled: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  Enable embed widget
                </label>
                {editForm.widgetEnabled && (
                  <>
                    <div className="grid gap-2">
                      <Label>Primary Color (hex)</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editForm.widgetPrimaryColor || "#c94277"}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, widgetPrimaryColor: e.target.value }))
                          }
                          className="h-9 w-12 cursor-pointer rounded border border-input p-1"
                        />
                        <Input
                          value={editForm.widgetPrimaryColor}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, widgetPrimaryColor: e.target.value }))
                          }
                          placeholder="#3b82f6"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Logo URL</Label>
                      <Input
                        value={editForm.widgetLogoUrl}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, widgetLogoUrl: e.target.value }))
                        }
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Custom Heading</Label>
                      <Input
                        value={editForm.widgetCustomHeading}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, widgetCustomHeading: e.target.value }))
                        }
                        placeholder="Trade in your old phone for cash"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                editLoading ||
                !editForm.name.trim() ||
                !editForm.code.trim() ||
                (!editForm.modeA && !editForm.modeB && !editForm.modeC)
              }
            >
              {editLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate API Key Dialog */}
      <Dialog open={generateKeyOpen} onOpenChange={setGenerateKeyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>
              {generatedApiKey
                ? "Copy this key now. It will not be shown again."
                : `Create a new API key for ${partner.name}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {generatedApiKey ? (
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedApiKey}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyApiKey}
                    className="shrink-0"
                  >
                    {apiKeyCopied ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Store this key securely. It cannot be retrieved later.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="key-label">Label (optional)</Label>
                  <Input
                    id="key-label"
                    placeholder="e.g. Production, Staging"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newKeySandbox}
                    onChange={(e) => setNewKeySandbox(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm font-medium">Sandbox key</span>
                  <span className="text-xs text-muted-foreground">
                    (testing only — no emails, commissions, or customer records)
                  </span>
                </label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenerateKeyOpen(false)}
            >
              {generatedApiKey ? "Close" : "Cancel"}
            </Button>
            {!generatedApiKey && (
              <Button
                onClick={handleGenerateApiKey}
                disabled={generateKeyLoading}
              >
                {generateKeyLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Generate
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke API Key Dialog */}
      <Dialog open={!!revokeKeyId} onOpenChange={() => setRevokeKeyId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              This key will be immediately deactivated. Any requests using it
              will return 401 Unauthorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeKeyId(null)}
              disabled={revokeKeyLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeApiKey}
              disabled={revokeKeyLoading}
            >
              {revokeKeyLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
