"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Smartphone, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency-context";

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
  status: string;
  paymentStatus: string;
  items: OrderItem[];
  upsellItems: UpsellOrderItem[];
  subtotalAUD: number;
  shippingAUD: number;
  totalAUD: number;
  gstAUD: number;
  displayCurrency: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postcode: string;
    country: string;
  };
  createdAt: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const { currency, convertFromAUD } = useCurrency();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ---- fetch order --------------------------------------------------------
  useEffect(() => {
    if (!id) return;

    // Try to get email from sessionStorage (set during checkout)
    const email = sessionStorage.getItem("checkout-email") ?? "";

    const params = new URLSearchParams();
    if (email) params.set("email", email);

    fetch(`/api/buy/orders/${id}?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data: OrderDetail) => setOrder(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // ---- helpers ------------------------------------------------------------
  const formatPrice = (priceAUD: number) => {
    const displayPrice =
      currency === "AUD" ? priceAUD : convertFromAUD(priceAUD);
    return new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-NZ", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(displayPrice);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ---- loading / not found ------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Order not found.</p>
        <Link
          href="/buy/browse"
          className="mt-4 inline-block text-sm font-medium text-foreground underline"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  // ---- render -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Success header */}
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-foreground" />
        <h1 className="mt-4 text-2xl font-medium tracking-tight">
          Thank you for your order
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Order #{order.orderNumber} &middot; {formatDate(order.createdAt)}
        </p>
        <Badge variant="secondary" className="mt-2">
          {order.paymentStatus === "paid" ? "Paid" : order.status}
        </Badge>
      </div>

      {/* Order items */}
      <div className="mt-8 rounded-lg border border-border bg-card">
        <div className="divide-y divide-border">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded border border-border bg-background">
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Smartphone className="h-4 w-4" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.description}</p>
              </div>
              <p className="text-sm font-medium tabular-nums">
                {formatPrice(item.priceAUD)}
              </p>
            </div>
          ))}
          {/* Upsell items */}
          {order.upsellItems?.length > 0 &&
            order.upsellItems.map((item, idx) => (
              <div key={`upsell-${idx}`} className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded border border-border bg-background">
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-medium tabular-nums">
                  {formatPrice(item.priceAUD * item.quantity)}
                </p>
              </div>
            ))}
        </div>

        {/* Totals */}
        <div className="border-t border-border p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">
              {formatPrice(order.subtotalAUD)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span className="text-muted-foreground">
              {order.shippingAUD > 0 ? formatPrice(order.shippingAUD) : "Free"}
            </span>
          </div>
          <div className="border-t border-border pt-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total</span>
              <span className="text-lg font-medium tabular-nums">
                {formatPrice(order.totalAUD)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground text-right">
              Includes {formatPrice(order.gstAUD)} GST
            </p>
          </div>
        </div>
      </div>

      {/* Shipping address */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Shipping to</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {order.customerName}
          <br />
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
            : "Australia"}
        </p>
      </div>

      {/* Confirmation email notice */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        A confirmation email will be sent to {order.customerEmail}.
      </p>

      {/* Continue shopping */}
      <div className="mt-6 text-center">
        <Link href="/buy/browse">
          <Button variant="outline">Continue Shopping</Button>
        </Link>
      </div>
    </div>
  );
}
