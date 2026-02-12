"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Smartphone, Check, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/lib/currency-context";
import { useCart } from "@/lib/cart-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductDetail {
  id: string;
  make: string;
  model: string;
  storage: string;
  category: string;
  cosmeticGrade: string;
  batteryHealth: number | null;
  sellPriceNZD: number;
  sellPriceAUD: number | null;
  images: string[];
  spinVideo: string | null;
  notes: string;
}

// ---------------------------------------------------------------------------
// Grade descriptions
// ---------------------------------------------------------------------------

const GRADE_DESCRIPTIONS: Record<string, string> = {
  A: "Excellent condition. No visible scratches or wear.",
  B: "Good condition. Minor signs of use, barely noticeable.",
  C: "Fair condition. Some visible scratches or light wear.",
  D: "Acceptable condition. Noticeable wear and cosmetic marks.",
  E: "Poor condition. Significant wear, fully functional.",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currency, convertFromNZD } = useCurrency();
  const { addItem, isInCart } = useCart();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  const alreadyInCart = product ? isInCart(product.id) : false;

  // ---- fetch product ------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/shop/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data: ProductDetail) => {
        setProduct(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

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

  const handleAddToCart = () => {
    if (!product || alreadyInCart) return;
    addItem({
      inventoryId: product.id,
      make: product.make,
      model: product.model,
      storage: product.storage,
      cosmeticGrade: product.cosmeticGrade,
      sellPriceNZD: product.sellPriceNZD,
      image: product.images[0] ?? null,
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

  if (notFound || !product) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Product not found.</p>
        <Link
          href="/shop"
          className="mt-4 inline-block text-sm font-medium text-foreground underline"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  const deviceName = [product.make, product.model, product.storage]
    .filter(Boolean)
    .join(" ");

  // ---- render -------------------------------------------------------------
  return (
    <div>
      {/* Back link */}
      <Link
        href="/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Shop
      </Link>

      {/* Two-column layout */}
      <div className="mt-6 grid gap-8 lg:grid-cols-5">
        {/* Image area — left 3/5 */}
        <div className="lg:col-span-3">
          {/* Main image / video */}
          <div className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-card">
            {product.spinVideo ? (
              <video
                src={product.spinVideo}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-contain"
              />
            ) : product.images.length > 0 ? (
              <img
                src={product.images[selectedImage] ?? product.images[0]}
                alt={deviceName}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Smartphone className="h-20 w-20" />
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded border transition-colors ${
                    selectedImage === idx
                      ? "border-foreground"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  <img
                    src={img}
                    alt={`${deviceName} view ${idx + 1}`}
                    className="h-full w-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details — right 2/5 */}
        <div className="lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {product.category}
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            {product.make} {product.model}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.storage}
          </p>

          {/* Price */}
          <p className="mt-6 text-3xl font-medium tabular-nums">
            {formatPrice(product.sellPriceNZD)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currency === "AUD" ? "AUD incl. GST" : "NZD incl. GST"}
          </p>

          {/* Grade */}
          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cosmetic Grade</span>
              <Badge variant="secondary" className="text-sm">
                Grade {product.cosmeticGrade}
              </Badge>
            </div>
            {GRADE_DESCRIPTIONS[product.cosmeticGrade] && (
              <p className="mt-2 text-sm text-muted-foreground">
                {GRADE_DESCRIPTIONS[product.cosmeticGrade]}
              </p>
            )}
          </div>

          {/* Battery health */}
          {product.batteryHealth != null && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Battery Health</span>
                <span className="text-sm font-medium tabular-nums">
                  {product.batteryHealth}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${product.batteryHealth}%`,
                    backgroundColor:
                      product.batteryHealth >= 80
                        ? "hsl(var(--primary))"
                        : product.batteryHealth >= 60
                          ? "hsl(43 74% 56%)"
                          : "hsl(var(--destructive))",
                  }}
                />
              </div>
            </div>
          )}

          {/* Condition notes */}
          {product.notes && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <span className="text-sm font-medium">Condition Notes</span>
              <p className="mt-1 text-sm text-muted-foreground">
                {product.notes}
              </p>
            </div>
          )}

          {/* Add to cart */}
          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={alreadyInCart}
            onClick={handleAddToCart}
          >
            {alreadyInCart ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                In Cart
              </>
            ) : (
              <>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Add to Cart
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
