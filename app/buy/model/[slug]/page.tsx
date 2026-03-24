"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Smartphone, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/lib/currency-context";
import { GRADE_LABELS } from "@/lib/grades";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelUnit {
  id: string;
  make: string;
  model: string;
  storage: string;
  category: string;
  cosmeticGrade: string;
  batteryHealth: number | null;
  sellPriceAUD: number;
  sellPriceNZD: number | null;
  images: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ModelPage() {
  const { slug } = useParams<{ slug: string }>();
  const { currency, convertFromAUD } = useCurrency();

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [units, setUnits] = useState<ModelUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/buy/products/by-model/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setMake(data.make);
        setModel(data.model);
        setUnits(data.items);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

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

  // ---- loading / not found ------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || units.length === 0) {
    return (
      <div className="py-20 text-center">
        <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          No devices found for this model.
        </p>
        <Link
          href="/buy/browse"
          className="mt-4 inline-block text-sm font-medium text-foreground underline"
        >
          Back to Browse
        </Link>
      </div>
    );
  }

  // ---- render -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/buy/browse"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Browse
      </Link>

      {/* Header */}
      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {make}
        </p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">{model}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {units.length} {units.length === 1 ? "device" : "devices"} available
        </p>
      </div>

      {/* Unit grid */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((unit) => (
          <Link key={unit.id} href={`/buy/${unit.id}`}>
            <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20">
              {/* Image */}
              <div className="aspect-square w-full overflow-hidden rounded bg-background">
                {unit.images.length > 0 ? (
                  <img
                    src={unit.images[0]}
                    alt={`${unit.make} ${unit.model} ${unit.storage}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Smartphone className="h-12 w-12" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{unit.storage}</p>
                  <Badge variant="secondary" className="text-xs">
                    Grade {unit.cosmeticGrade}
                    {GRADE_LABELS[unit.cosmeticGrade]
                      ? ` · ${GRADE_LABELS[unit.cosmeticGrade]}`
                      : ""}
                  </Badge>
                </div>

                {unit.batteryHealth != null && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Battery</span>
                    <span className="font-medium tabular-nums">
                      {unit.batteryHealth}%
                    </span>
                  </div>
                )}

                <p className="text-lg font-medium tabular-nums text-foreground">
                  {formatPrice(unit.sellPriceAUD)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
