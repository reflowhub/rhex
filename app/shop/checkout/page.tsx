"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { currency, convertFromNZD } = useCurrency();

  // ---- form state ---------------------------------------------------------
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("NZ");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  const isFormValid =
    name.trim() &&
    email.trim() &&
    line1.trim() &&
    city.trim() &&
    region.trim() &&
    postcode.trim() &&
    country;

  // ---- submit -------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setError("");

    // Store email in sessionStorage for order confirmation page
    sessionStorage.setItem("checkout-email", email.trim());

    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ inventoryId: item.inventoryId })),
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim() || null,
          shippingAddress: {
            line1: line1.trim(),
            line2: line2.trim() || undefined,
            city: city.trim(),
            region: region.trim(),
            postcode: postcode.trim(),
            country,
          },
          currency,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        clearCart();
        if (data.url) {
          // Stripe mode — redirect to Stripe Checkout
          window.location.href = data.url;
        } else {
          // Stub mode — redirect to order confirmation
          router.push(`/shop/order/${data.orderId}`);
        }
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to place order. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- empty cart redirect ------------------------------------------------
  if (items.length === 0 && !submitting) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/shop"
          className="mt-4 inline-block text-sm font-medium text-foreground underline"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  // ---- render -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/shop/cart"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Cart
      </Link>

      <h1 className="mt-4 text-2xl font-medium tracking-tight">Checkout</h1>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mt-6 grid gap-8 lg:grid-cols-5">
          {/* Form — left 3/5 */}
          <div className="space-y-6 lg:col-span-3">
            {/* Customer details */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-medium">Customer Details</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Shipping address */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-medium">Shipping Address</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="line1">Address Line 1 *</Label>
                  <Input
                    id="line1"
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="line2">Address Line 2</Label>
                  <Input
                    id="line2"
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="region">State / Region *</Label>
                    <Input
                      id="region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="postcode">Postcode *</Label>
                    <Input
                      id="postcode"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger id="country" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NZ">New Zealand</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Order summary — right 2/5 */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-medium">Order Summary</h2>
              <div className="mt-4 divide-y divide-border">
                {items.map((item) => {
                  const deviceName = [item.make, item.model, item.storage]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <div
                      key={item.inventoryId}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded border border-border bg-background">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={deviceName}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Smartphone className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {deviceName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Grade {item.cosmeticGrade}
                        </p>
                      </div>
                      <p className="text-sm font-medium tabular-nums">
                        {formatPrice(item.sellPriceNZD)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-border pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">
                    {formatPrice(subtotalNZD)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-muted-foreground">Free</span>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total</span>
                    <span className="text-lg font-medium tabular-nums">
                      {formatPrice(subtotalNZD)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Place order button */}
            <Button
              type="submit"
              className="mt-4 w-full"
              size="lg"
              disabled={!isFormValid || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Place Order"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
