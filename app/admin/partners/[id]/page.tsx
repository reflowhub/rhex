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
} from "lucide-react";
import { useFX } from "@/lib/use-fx";

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
  currency: "AUD" | "NZD";
  contactPerson: string | null;
  contactPhone: string | null;
  address: string | null;
  companyName: string | null;
  companyRegistrationNumber: string | null;
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
    commissionModel: "percentage",
    commissionPercent: 5,
    commissionFlat: 5,
    partnerRateDiscount: 5,
    payoutFrequency: "monthly",
    contactPerson: "",
    contactPhone: "",
    address: "",
    companyName: "",
    companyRegistrationNumber: "",
  });

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
      commissionModel: partner.commissionModel || "percentage",
      commissionPercent: partner.commissionPercent ?? 5,
      commissionFlat: partner.commissionFlat ?? 5,
      partnerRateDiscount: partner.partnerRateDiscount ?? 5,
      payoutFrequency: partner.payoutFrequency || "monthly",
      contactPerson: partner.contactPerson ?? "",
      contactPhone: partner.contactPhone ?? "",
      address: partner.address ?? "",
      companyName: partner.companyName ?? "",
      companyRegistrationNumber: partner.companyRegistrationNumber ?? "",
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
          payoutFrequency: editForm.payoutFrequency,
          contactPerson: editForm.contactPerson.trim() || null,
          contactPhone: editForm.contactPhone.trim() || null,
          address: editForm.address.trim() || null,
          companyName: editForm.companyName.trim() || null,
          companyRegistrationNumber: editForm.companyRegistrationNumber.trim() || null,
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
        <Button variant="outline" onClick={openEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
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
                    {m === "A" ? "Referral" : "Hands-On"}
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
                    {partner.partnerRateDiscount ?? 5}% below public payout
                  </dd>
                </div>
                <div className="flex justify-between pl-6">
                  <dt className="text-muted-foreground">Partner Receives</dt>
                  <dd className="font-medium">
                    {100 - (partner.partnerRateDiscount ?? 5)}% of public payout
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
                  Mode B (Hands-On)
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

            {editForm.modeB && (
              <div className="rounded-md border border-border p-4 space-y-3">
                <p className="text-sm font-medium">Mode B — Partner Rate</p>
                <div className="grid gap-2">
                  <Label>Rate Discount (% below public payout)</Label>
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
                (!editForm.modeA && !editForm.modeB)
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
    </div>
  );
}
