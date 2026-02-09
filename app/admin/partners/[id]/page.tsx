"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

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

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();

  // ---- data state
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    contactEmail: "",
    status: "active",
    modeA: false,
    modeB: false,
    commissionModel: "percentage",
    commissionPercent: 5,
    commissionFlat: 5,
    partnerRateDiscount: 5,
    payoutFrequency: "monthly",
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

  // ---- open edit dialog with current values
  const openEdit = () => {
    if (!partner) return;
    setEditForm({
      name: partner.name,
      code: partner.code,
      contactEmail: partner.contactEmail,
      status: partner.status,
      modeA: partner.modes.includes("A"),
      modeB: partner.modes.includes("B"),
      commissionModel: partner.commissionModel || "percentage",
      commissionPercent: partner.commissionPercent ?? 5,
      commissionFlat: partner.commissionFlat ?? 5,
      partnerRateDiscount: partner.partnerRateDiscount ?? 5,
      payoutFrequency: partner.payoutFrequency || "monthly",
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
          modes,
          commissionModel: editForm.commissionModel,
          commissionPercent: editForm.commissionPercent,
          commissionFlat: editForm.commissionFlat,
          partnerRateDiscount: editForm.partnerRateDiscount,
          payoutFrequency: editForm.payoutFrequency,
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
                  {formatCurrency(partner.commissionSummary.totalPending)} NZD
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Paid</dt>
                <dd className="font-medium text-emerald-600">
                  {formatCurrency(partner.commissionSummary.totalPaid)} NZD
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
      </div>

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
