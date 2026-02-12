"use client";

import { useState, useEffect, useCallback } from "react";
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
  User,
  Package,
  Gift,
  MapPin,
  DollarSign,
  Truck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderItem {
  inventoryId: string;
  deviceRef: string;
  description: string;
  priceAUD: number;
}

interface UpsellOrderItem {
  upsellId: string;
  name: string;
  priceAUD: number;
  quantity: number;
}

interface OrderDetail {
  id: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postcode: string;
    country: string;
  };
  items: OrderItem[];
  upsellItems: UpsellOrderItem[];
  subtotalAUD: number;
  shippingAUD: number;
  totalAUD: number;
  gstAUD: number;
  displayCurrency: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  paymentStatus: string;
  status: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARRIERS = ["NZ Post", "CourierPost", "AusPost", "Other"] as const;

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

function orderStatusBadgeProps(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
} {
  switch (status) {
    case "pending":
      return { variant: "outline" };
    case "paid":
      return {
        variant: "default",
        className:
          "border-transparent bg-blue-600 text-white hover:bg-blue-600/80",
      };
    case "processing":
      return {
        variant: "secondary",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "shipped":
      return {
        variant: "default",
        className:
          "border-transparent bg-purple-600 text-white hover:bg-purple-600/80",
      };
    case "delivered":
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatAUD(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ---- data state ---------------------------------------------------------
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- fulfillment state --------------------------------------------------
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");

  // ---- cancel dialog state ------------------------------------------------
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ---- fetch order --------------------------------------------------------
  const fetchOrder = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/orders/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Order not found");
        return res.json();
      })
      .then((data: OrderDetail) => setOrder(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ---- action handlers ----------------------------------------------------
  const handleStatusUpdate = async (
    newStatus: string,
    extra?: Record<string, unknown>
  ) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      if (res.ok) {
        fetchOrder();
      } else {
        const data = await res.json();
        setActionError(data.error || "Failed to update order");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkShipped = () => {
    if (!trackingNumber.trim() || !trackingCarrier) return;
    handleStatusUpdate("shipped", {
      trackingNumber: trackingNumber.trim(),
      trackingCarrier,
    });
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        setCancelOpen(false);
        fetchOrder();
      }
    } finally {
      setCancelLoading(false);
    }
  };

  // ---- render: loading ----------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading order...
        </span>
      </div>
    );
  }

  // ---- render: error / not found ------------------------------------------
  if (error || !order) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {error ?? "Order not found."}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/orders")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
      </div>
    );
  }

  const badgeProps = orderStatusBadgeProps(order.status);
  const canCancel = order.status === "paid" || order.status === "processing";

  // ---- render: main -------------------------------------------------------
  return (
    <div>
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/orders")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Orders
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Order #{order.orderNumber}
          </h1>
          <Badge variant={badgeProps.variant} className={badgeProps.className}>
            {order.status}
          </Badge>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ---- Left column ------------------------------------------------ */}
        <div className="space-y-6">
          {/* Customer Info card */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Customer</h2>
            </div>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{order.customerName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd>
                  <a
                    href={`mailto:${order.customerEmail}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {order.customerEmail}
                  </a>
                </dd>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium">{order.customerPhone}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Items card */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">
                Items ({order.items.length + (order.upsellItems?.length ?? 0)})
              </h2>
            </div>
            <div className="divide-y divide-border">
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <button
                      onClick={() =>
                        router.push(`/admin/inventory/${item.inventoryId}`)
                      }
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      View inventory item
                    </button>
                  </div>
                  <p className="ml-4 text-sm font-medium tabular-nums">
                    {formatAUD(item.priceAUD)}
                  </p>
                </div>
              ))}
              {order.upsellItems?.length > 0 &&
                order.upsellItems.map((item, idx) => (
                  <div
                    key={`upsell-${idx}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-sm font-medium">{item.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Add-on &middot; Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="ml-4 text-sm font-medium tabular-nums">
                      {formatAUD(item.priceAUD * item.quantity)}
                    </p>
                  </div>
                ))}
            </div>
          </div>

          {/* Shipping Address card */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Shipping Address</h2>
            </div>
            <p className="text-sm leading-relaxed">
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 && (
                <>
                  <br />
                  {order.shippingAddress.line2}
                </>
              )}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.region}{" "}
              {order.shippingAddress.postcode}
              <br />
              {order.shippingAddress.country === "NZ"
                ? "New Zealand"
                : order.shippingAddress.country === "AU"
                  ? "Australia"
                  : order.shippingAddress.country}
            </p>
          </div>
        </div>

        {/* ---- Right column ----------------------------------------------- */}
        <div className="space-y-6">
          {/* Order Summary card */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Order Summary</h2>
            </div>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium tabular-nums">
                  {formatAUD(order.subtotalAUD)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-medium">
                  {order.shippingAUD > 0 ? formatAUD(order.shippingAUD) : "Free"}
                </dd>
              </div>
              <div className="my-1 h-px bg-border" />
              <div className="flex justify-between">
                <dt className="font-medium">Total</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatAUD(order.totalAUD)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">GST (included)</dt>
                <dd className="font-medium tabular-nums">
                  {formatAUD(order.gstAUD)}
                </dd>
              </div>
              <div className="my-1 h-px bg-border" />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Display Currency</dt>
                <dd className="font-medium">{order.displayCurrency}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payment Status</dt>
                <dd>
                  <Badge
                    variant={
                      order.paymentStatus === "paid" ? "default" : "outline"
                    }
                    className={
                      order.paymentStatus === "paid"
                        ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80"
                        : undefined
                    }
                  >
                    {order.paymentStatus}
                  </Badge>
                </dd>
              </div>
              {order.stripeCheckoutSessionId && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Stripe Session</dt>
                  <dd className="font-mono text-xs truncate max-w-[180px]">
                    {order.stripeCheckoutSessionId}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Fulfillment card */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Fulfillment</h2>
            </div>

            {actionError && (
              <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {actionError}
              </div>
            )}

            {/* Tracking info (if shipped or delivered) */}
            {order.trackingNumber && (
              <dl className="mb-4 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Carrier</dt>
                  <dd className="font-medium">{order.trackingCarrier}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tracking Number</dt>
                  <dd className="font-mono text-xs">{order.trackingNumber}</dd>
                </div>
                {order.shippedAt && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Shipped</dt>
                    <dd className="text-sm">{formatDate(order.shippedAt)}</dd>
                  </div>
                )}
              </dl>
            )}

            {order.deliveredAt && (
              <dl className="mb-4 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivered</dt>
                  <dd className="text-sm">{formatDate(order.deliveredAt)}</dd>
                </div>
              </dl>
            )}

            {order.cancelledAt && (
              <dl className="mb-4 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cancelled</dt>
                  <dd className="text-sm">{formatDate(order.cancelledAt)}</dd>
                </div>
              </dl>
            )}

            {/* Status-specific actions */}
            <div className="space-y-3">
              {order.status === "paid" && (
                <Button
                  className="w-full"
                  disabled={actionLoading}
                  onClick={() => handleStatusUpdate("processing")}
                >
                  {actionLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Mark as Processing
                </Button>
              )}

              {order.status === "processing" && (
                <>
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="tracking-number">Tracking Number</Label>
                      <Input
                        id="tracking-number"
                        placeholder="e.g. NZ123456789"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="tracking-carrier">Carrier</Label>
                      <Select
                        value={trackingCarrier}
                        onValueChange={setTrackingCarrier}
                      >
                        <SelectTrigger id="tracking-carrier">
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                        <SelectContent>
                          {CARRIERS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={
                      actionLoading ||
                      !trackingNumber.trim() ||
                      !trackingCarrier
                    }
                    onClick={handleMarkShipped}
                  >
                    {actionLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Mark as Shipped
                  </Button>
                </>
              )}

              {order.status === "shipped" && (
                <Button
                  className="w-full"
                  disabled={actionLoading}
                  onClick={() => handleStatusUpdate("delivered")}
                >
                  {actionLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Mark as Delivered
                </Button>
              )}

              {/* Cancel button */}
              {canCancel && (
                <>
                  <div className="my-2 h-px bg-border" />
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel Order
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="mt-6 flex gap-6 text-xs text-muted-foreground">
        <span>Created: {formatDate(order.createdAt)}</span>
        <span>Updated: {formatDate(order.updatedAt)}</span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Cancel Confirmation Dialog                                          */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel Order #{order.orderNumber}? This
              will return all items to inventory. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelLoading}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelLoading}
            >
              {cancelLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
