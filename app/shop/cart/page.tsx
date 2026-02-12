"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Smartphone, X, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem } = useCart();
  const { currency, convertFromNZD } = useCurrency();
  const [validating, setValidating] = useState(true);
  const [removedNames, setRemovedNames] = useState<string[]>([]);

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
          const res = await fetch(`/api/shop/products/${item.inventoryId}`);
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
  const formatPrice = (priceNZD: number) => {
    const displayPrice =
      currency === "NZD" ? priceNZD : convertFromNZD(priceNZD);
    return new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-NZ", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(displayPrice);
  };

  const subtotalNZD = items.reduce((sum, item) => sum + item.sellPriceNZD, 0);

  // ---- render -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl">
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
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Your cart is empty.
          </p>
          <Link
            href="/shop"
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
                      href={`/shop/${item.inventoryId}`}
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
                    {formatPrice(item.sellPriceNZD)}
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

          {/* Summary */}
          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatPrice(subtotalNZD)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Shipping</span>
              <span className="text-sm text-muted-foreground">Free</span>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className="text-lg font-medium tabular-nums">
                  {formatPrice(subtotalNZD)}
                </span>
              </div>
            </div>
          </div>

          {/* Checkout button */}
          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={() => router.push("/shop/checkout")}
          >
            Proceed to Checkout
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
