"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Smartphone,
  DollarSign,
  Package,
  MapPin,
  Pencil,
  ImageIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryItem {
  id: string;
  inventoryId: number;
  deviceRef: string;
  device: { id: string; make: string; model: string; storage: string } | null;
  category: string;
  serial: string;
  sourceType: string;
  sourceQuoteId: string | null;
  sourceQuote: {
    id: string;
    customerName: string | null;
    status: string;
    grade: string | null;
    quotePriceNZD: number | null;
  } | null;
  acquiredAt: string | null;
  costNZD: number | null;
  costAUD: number | null;
  sourceName: string | null;
  cosmeticGrade: string;
  batteryHealth: number | null;
  notes: string;
  sellPriceAUD: number;
  sellPriceNZD: number | null;
  status: string;
  listed: boolean;
  images: string[];
  spinVideo: string | null;
  location: string | null;
  returnReason: string | null;
  returnedFromOrderId: string | null;
  returnedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVENTORY_STATUSES = [
  "received",
  "inspecting",
  "refurbishing",
  "listed",
  "reserved",
  "sold",
  "parts_only",
];

const GRADES = ["A", "B", "C", "D", "E"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeProps(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
} {
  switch (status) {
    case "received":
      return { variant: "secondary" };
    case "inspecting":
      return { variant: "outline" };
    case "refurbishing":
      return {
        variant: "outline",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "listed":
      return {
        variant: "default",
        className:
          "border-transparent bg-blue-600 text-white hover:bg-blue-600/80",
      };
    case "reserved":
      return {
        variant: "default",
        className:
          "border-transparent bg-purple-600 text-white hover:bg-purple-600/80",
      };
    case "sold":
      return {
        variant: "default",
        className:
          "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80",
      };
    case "parts_only":
      return { variant: "destructive" };
    default:
      return { variant: "outline" };
  }
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

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ---- data state ---------------------------------------------------------
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- edit dialog state --------------------------------------------------
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    status: "",
    cosmeticGrade: "",
    sellPriceAUD: "",
    sellPriceNZD: "",
    batteryHealth: "",
    location: "",
    listed: false,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- fetch item ---------------------------------------------------------
  const fetchItem = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/inventory/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Inventory item not found");
        return res.json();
      })
      .then((data: InventoryItem) => setItem(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // ---- open edit dialog ---------------------------------------------------
  const openEdit = () => {
    if (!item) return;
    setEditData({
      status: item.status,
      cosmeticGrade: item.cosmeticGrade,
      sellPriceAUD: String(item.sellPriceAUD),
      sellPriceNZD: item.sellPriceNZD != null ? String(item.sellPriceNZD) : "",
      batteryHealth:
        item.batteryHealth != null ? String(item.batteryHealth) : "",
      location: item.location ?? "",
      listed: item.listed,
      notes: item.notes,
    });
    setFormError(null);
    setEditOpen(true);
  };

  // ---- submit edit --------------------------------------------------------
  const handleSave = async () => {
    if (!item) return;
    setSubmitting(true);
    setFormError(null);

    const body: Record<string, unknown> = {
      status: editData.status,
      cosmeticGrade: editData.cosmeticGrade,
      sellPriceAUD: parseFloat(editData.sellPriceAUD),
      listed: editData.listed,
      notes: editData.notes,
    };

    if (editData.sellPriceNZD) {
      body.sellPriceNZD = parseFloat(editData.sellPriceNZD);
    }
    if (editData.batteryHealth) {
      body.batteryHealth = parseInt(editData.batteryHealth, 10);
    }
    if (editData.location) {
      body.location = editData.location;
    }

    try {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditOpen(false);
        fetchItem();
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to update");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- helpers ------------------------------------------------------------
  const formatPrice = (amount: number | null | undefined) => {
    if (amount == null) return "\u2014";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  // ---- render: loading ----------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading inventory item...
        </span>
      </div>
    );
  }

  // ---- render: error / not found ------------------------------------------
  if (error || !item) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {error ?? "Inventory item not found."}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/inventory")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inventory
        </Button>
      </div>
    );
  }

  const badgeProps = statusBadgeProps(item.status);
  const cost = item.costAUD ?? item.costNZD ?? 0;
  const costLabel = item.costAUD != null ? "Cost (AUD)" : "Cost (NZD)";
  const margin = item.sellPriceAUD - cost;
  const marginPercent =
    cost > 0 ? ((margin / cost) * 100).toFixed(0) : "\u2014";

  const sourceTypeLabel: Record<string, string> = {
    "trade-in": "Trade-in",
    bulk: "Bulk Quote",
    "direct-purchase": "Direct Purchase",
    manual: "Manual Entry",
    return: "Customer Return",
  };

  // ---- render: main -------------------------------------------------------
  return (
    <div>
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/inventory")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Inventory
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Inventory #{item.inventoryId}
          </h1>
          <Badge variant={badgeProps.variant} className={badgeProps.className}>
            {formatStatus(item.status)}
          </Badge>
        </div>
        <Button variant="outline" onClick={openEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Two-column grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Device Information card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Device Information</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Device</dt>
              <dd className="font-medium text-right">
                {item.device
                  ? `${item.device.make} ${item.device.model}`
                  : "\u2014"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Storage</dt>
              <dd className="font-medium">
                {item.device?.storage ?? "\u2014"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium">{item.category}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Serial / IMEI</dt>
              <dd className="font-mono text-xs">{item.serial}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Grade</dt>
              <dd>
                <Badge variant="outline">{item.cosmeticGrade}</Badge>
              </dd>
            </div>
          </dl>
        </div>

        {/* Financial card */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Financial</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{costLabel}</dt>
              <dd className="font-medium">{formatPrice(cost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sell Price (AUD)</dt>
              <dd className="font-medium">{formatPrice(item.sellPriceAUD)}</dd>
            </div>
            {item.sellPriceNZD != null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Sell Price (NZD)</dt>
                <dd className="font-medium">
                  {formatPrice(item.sellPriceNZD)}
                </dd>
              </div>
            )}
            <div className="my-1 h-px bg-border" />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Margin</dt>
              <dd
                className={cn(
                  "font-medium",
                  margin > 0
                    ? "text-emerald-600"
                    : margin < 0
                    ? "text-destructive"
                    : ""
                )}
              >
                {formatPrice(margin)} ({marginPercent}%)
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Source card */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Source</h2>
        </div>

        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Source Type</dt>
            <dd>
              <Badge variant="secondary">
                {sourceTypeLabel[item.sourceType] ?? item.sourceType}
              </Badge>
            </dd>
          </div>
          {item.sourceName && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Supplier</dt>
              <dd className="font-medium">{item.sourceName}</dd>
            </div>
          )}
          {item.sourceQuoteId && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Source Quote</dt>
              <dd>
                <button
                  onClick={() => {
                    const path =
                      item.sourceType === "bulk"
                        ? `/admin/bulk-quotes/${item.sourceQuoteId}`
                        : `/admin/quotes/${item.sourceQuoteId}`;
                    router.push(path);
                  }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {item.sourceQuoteId.substring(0, 8)}...
                </button>
                {item.sourceQuote?.customerName && (
                  <span className="ml-2 text-muted-foreground">
                    ({item.sourceQuote.customerName})
                  </span>
                )}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Acquired</dt>
            <dd>{formatDate(item.acquiredAt)}</dd>
          </div>
          {item.returnedAt && (
            <>
              <div className="my-1 h-px bg-border" />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Returned</dt>
                <dd>{formatDate(item.returnedAt)}</dd>
              </div>
              {item.returnReason && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Return Reason</dt>
                  <dd className="font-medium">{item.returnReason}</dd>
                </div>
              )}
              {item.returnedFromOrderId && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">From Order</dt>
                  <dd>
                    <button
                      onClick={() =>
                        router.push(
                          `/admin/orders/${item.returnedFromOrderId}`
                        )
                      }
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {item.returnedFromOrderId.substring(0, 8)}...
                    </button>
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
      </div>

      {/* Condition & Location card */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Condition & Location</h2>
        </div>

        <dl className="grid gap-3 text-sm">
          {item.batteryHealth != null && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Battery Health</dt>
              <dd className="font-medium">{item.batteryHealth}%</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Location</dt>
            <dd className="font-medium">{item.location || "\u2014"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Listed</dt>
            <dd>
              <Badge variant={item.listed ? "default" : "secondary"}>
                {item.listed ? "Yes" : "No"}
              </Badge>
            </dd>
          </div>
          {item.notes && (
            <>
              <div className="my-1 h-px bg-border" />
              <div>
                <dt className="text-muted-foreground mb-1">Notes</dt>
                <dd className="whitespace-pre-wrap text-sm">{item.notes}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Images placeholder card */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Images</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Image management coming in Phase 2.
          {item.images.length > 0 && (
            <span className="ml-1">
              ({item.images.length} image{item.images.length !== 1 ? "s" : ""}{" "}
              attached)
            </span>
          )}
        </p>
      </div>

      {/* Timestamps */}
      <div className="mt-6 flex gap-6 text-xs text-muted-foreground">
        <span>Created: {formatDate(item.createdAt)}</span>
        <span>Updated: {formatDate(item.updatedAt)}</span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Edit Dialog                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>
              Update details for Inventory #{item.inventoryId}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editData.status}
                onValueChange={(val) =>
                  setEditData((prev) => ({ ...prev, status: val }))
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatStatus(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grade */}
            <div className="grid gap-2">
              <Label htmlFor="edit-grade">Grade</Label>
              <Select
                value={editData.cosmeticGrade}
                onValueChange={(val) =>
                  setEditData((prev) => ({ ...prev, cosmeticGrade: val }))
                }
              >
                <SelectTrigger id="edit-grade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      Grade {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sell Price AUD */}
            <div className="grid gap-2">
              <Label htmlFor="edit-sell-price-aud">Sell Price (AUD)</Label>
              <Input
                id="edit-sell-price-aud"
                type="number"
                min="0"
                step="0.01"
                value={editData.sellPriceAUD}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    sellPriceAUD: e.target.value,
                  }))
                }
              />
            </div>

            {/* Sell Price NZD */}
            <div className="grid gap-2">
              <Label htmlFor="edit-sell-price">
                Sell Price (NZD) — optional
              </Label>
              <Input
                id="edit-sell-price"
                type="number"
                min="0"
                step="0.01"
                value={editData.sellPriceNZD}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    sellPriceNZD: e.target.value,
                  }))
                }
              />
            </div>

            {/* Battery Health */}
            <div className="grid gap-2">
              <Label htmlFor="edit-battery">Battery Health (%)</Label>
              <Input
                id="edit-battery"
                type="number"
                min="0"
                max="100"
                value={editData.batteryHealth}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    batteryHealth: e.target.value,
                  }))
                }
              />
            </div>

            {/* Location */}
            <div className="grid gap-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                placeholder="e.g. Shelf A3"
                value={editData.location}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    location: e.target.value,
                  }))
                }
              />
            </div>

            {/* Listed toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-listed">Listed on storefront</Label>
              <Switch
                id="edit-listed"
                checked={editData.listed}
                onCheckedChange={(checked) =>
                  setEditData((prev) => ({ ...prev, listed: checked }))
                }
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <textarea
                id="edit-notes"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={editData.notes}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={submitting || !editData.sellPriceAUD}
            >
              {submitting && (
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
