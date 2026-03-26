"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Smartphone, X, ShoppingBag, ArrowRight, Package, Minus, Plus, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";
import { calculateGST } from "@/lib/gst";
import { calculateShipping, type ShippingConfig } from "@/lib/shipping";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, upsellItems, removeUpsellItem, updateUpsellQuantity } = useCart();
  const { currency, convertFromAUD } = useCurrency();
  const [validating, setValidating] = useState(true);
  const [removedNames, setRemovedNames] = useState<string[]>([]);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);

  // Trade-in quote linking
  const [tradeInQuoteId, setTradeInQuoteId] = useState("");
  const [tradeInLinked, setTradeInLinked] = useState(false);
  const [tradeInError, setTradeInError] = useState("");
  const [tradeInValidating, setTradeInValidating] = useState(false);
  const [tradeInExpanded, setTradeInExpanded] = useState(false);

  // Restore linked quote from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("tradeInQuoteId");
    if (saved) {
      setTradeInQuoteId(saved);
      setTradeInLinked(true);
    }
  }, []);

  const handleLinkQuote = async () => {
    const id = tradeInQuoteId.trim();
    if (!id) return;

    setTradeInValidating(true);
    setTradeInError("");

    try {
      const res = await fetch(`/api/buy/quote/${encodeURIComponent(id)}`);
      if (!res.ok) {
        setTradeInError("Quote not found. Please check the ID.");
        return;
      }
      const data = await res.json();

      if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
        setTradeInError("This quote has expired. Please request a new one.");
        return;
      }
      if (data.status !== "accepted") {
        setTradeInError("Please accept your quote first before linking it.");
        return;
      }

      sessionStorage.setItem("tradeInQuoteId", id);
      setTradeInLinked(true);
    } catch {
      setTradeInError("Failed to validate quote. Please try again.");
    } finally {
      setTradeInValidating(false);
    }
  };

  const handleUnlinkQuote = () => {
    sessionStorage.removeItem("tradeInQuoteId");
    setTradeInLinked(false);
    setTradeInQuoteId("");
  };

  // ---- fetch shipping config -----------------------------------------------
  useEffect(() => {
    fetch("/api/buy/shipping")
      .then((res) => res.json())
      .then((data) => setShippingConfig(data))
      .catch(() => {});
  }, []);

  // ---- validate cart items on mount ---------------------------------------
  useEffect(() => {
    if (items.length === 0) {
      setValidating(false);
      return;
    }

    const validate = async () => {
      const removed: string[] = [];
      await Promise.allSettled(
        items.map(async (item) => {
          const res = await fetch(`/api/buy/products/${item.inventoryId}`);
          if (!res.ok) {
            removed.push(
              [item.make, item.model, item.storage].filter(Boolean).join(" ")
            );
            removeItem(item.inventoryId);
          }
        })
      );
      if (removed.length > 0) {
        setRemovedNames(removed);
      }
      setValidating(false);
    };

    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const inventorySubtotalAUD = items.reduce((sum, item) => sum + item.sellPriceAUD, 0);
  const upsellSubtotalAUD = upsellItems.reduce((sum, u) => sum + u.priceAUD * u.quantity, 0);
  const subtotalAUD = inventorySubtotalAUD + upsellSubtotalAUD;
  const shippingAUD = shippingConfig
    ? calculateShipping(
        items.map((i) => i.category ?? "Phone"),
        subtotalAUD,
        shippingConfig
      )
    : 0;
  const totalAUD = subtotalAUD + shippingAUD;

  // ---- render -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Cart</h1>

      {/* Removed items notice */}
      {removedNames.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          The following items are no longer available and were removed:{" "}
          <span className="font-medium text-foreground">
            {removedNames.join(", ")}
          </span>
        </div>
      )}

      {validating ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : items.length === 0 && upsellItems.length === 0 ? (
        <div className="py-20 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Your cart is empty.
          </p>
          <Link
            href="/buy/browse"
            className="mt-4 inline-block text-sm font-medium text-foreground underline"
          >
            Browse the shop
          </Link>
        </div>
      ) : (
        <>
          {/* Cart items */}
          <div className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
            {items.map((item) => {
              const deviceName = [item.make, item.model, item.storage]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={item.inventoryId}
                  className="flex items-center gap-4 p-4"
                >
                  {/* Thumbnail */}
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded border border-border bg-background">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={deviceName}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Smartphone className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/buy/${item.inventoryId}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {deviceName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Grade {item.cosmeticGrade}
                    </p>
                  </div>

                  {/* Price */}
                  <p className="font-medium tabular-nums text-foreground">
                    {formatPrice(item.sellPriceAUD)}
                  </p>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.inventoryId)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Remove item"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Upsell items */}
          {upsellItems.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Add-ons</h2>
              <div className="divide-y divide-border rounded-lg border border-border bg-card">
                {upsellItems.map((item) => (
                  <div
                    key={item.upsellId}
                    className="flex items-center gap-4 p-4"
                  >
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded border border-border bg-background">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatPrice(item.priceAUD)} each
                      </p>
                    </div>
                    {/* Quantity controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateUpsellQuantity(item.upsellId, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateUpsellQuantity(item.upsellId, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="font-medium tabular-nums text-foreground w-16 text-right">
                      {formatPrice(item.priceAUD * item.quantity)}
                    </p>
                    <button
                      onClick={() => removeUpsellItem(item.upsellId)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Remove item"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trade-in CTA */}
          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium">Have a device to trade in?</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Get a quote for your old device and receive a reply-paid satchel with your order.
                </p>

                {!tradeInLinked && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Link href="/sell">
                      <Button size="sm" variant="outline">
                        Start Trade-in
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    {!tradeInExpanded && (
                      <button
                        onClick={() => setTradeInExpanded(true)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Already have a quote?
                      </button>
                    )}
                  </div>
                )}

                {!tradeInLinked && tradeInExpanded && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Enter your trade-in quote ID to link it to this order.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Quote ID"
                        value={tradeInQuoteId}
                        onChange={(e) => {
                          setTradeInQuoteId(e.target.value);
                          setTradeInError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleLinkQuote();
                        }}
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!tradeInQuoteId.trim() || tradeInValidating}
                        onClick={handleLinkQuote}
                      >
                        {tradeInValidating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Link"
                        )}
                      </Button>
                    </div>
                    {tradeInError && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {tradeInError}
                      </div>
                    )}
                  </div>
                )}

                {tradeInLinked && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      Trade-in quote linked
                    </div>
                    <button
                      onClick={handleUnlinkQuote}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatPrice(subtotalAUD)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Shipping</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {shippingAUD > 0 ? formatPrice(shippingAUD) : "Free"}
              </span>
            </div>
            {shippingConfig && shippingConfig.freeThreshold > 0 && shippingAUD > 0 && (
              <p className="mt-1 text-xs text-muted-foreground text-right">
                Free shipping on orders over {formatPrice(shippingConfig.freeThreshold)}
              </p>
            )}
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className="text-lg font-medium tabular-nums">
                  {formatPrice(totalAUD)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground text-right">
                Includes {formatPrice(calculateGST(totalAUD))} GST
              </p>
            </div>
          </div>

          {/* Checkout button */}
          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={() => router.push("/buy/checkout")}
          >
            Proceed to Checkout
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
