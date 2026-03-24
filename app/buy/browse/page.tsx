"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Smartphone, Loader2 } from "lucide-react";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductGroup {
  slug: string;
  make: string;
  model: string;
  category: string;
  minPriceAUD: number;
  unitCount: number;
  storages: string[];
  grades: string[];
  heroImage: string | null;
}

interface CategoryInfo {
  name: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <BrowsePageInner />
    </Suspense>
  );
}

function BrowsePageInner() {
  const { currency, convertFromAUD } = useCurrency();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "";

  // ---- data state ---------------------------------------------------------
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- category state -----------------------------------------------------
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  // ---- fetch categories on mount ------------------------------------------
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const cats = data.map((c: { name: string }) => ({ name: c.name }));
          setCategories(cats);
        }
      })
      .catch(() => {});
  }, []);

  // ---- fetch grouped products ---------------------------------------------
  const fetchGroups = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory);

    const url = `/api/buy/products/grouped${params.toString() ? `?${params.toString()}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.groups) {
          setGroups(data.groups);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

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

  // ---- render -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Browse Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Certified refurbished devices, individually graded and photographed.
        </p>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="mt-6 flex gap-1 border-b border-border">
          <button
            onClick={() => setSelectedCategory("")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              !selectedCategory
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                selectedCategory === cat.name
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      <div className="mt-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center">
            <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              No devices available right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Link key={group.slug} href={`/buy/model/${group.slug}`}>
                <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20">
                  {/* Image area */}
                  <div className="aspect-square w-full overflow-hidden rounded bg-background">
                    {group.heroImage ? (
                      <img
                        src={group.heroImage}
                        alt={`${group.make} ${group.model}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Smartphone className="h-12 w-12" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {group.make}
                    </p>
                    <p className="font-medium text-foreground">
                      {group.model}
                    </p>
                    {group.storages.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {group.storages.join(" · ")}
                      </p>
                    )}
                    <div className="flex items-baseline justify-between pt-1">
                      <p className="text-lg font-medium tabular-nums text-foreground">
                        from {formatPrice(group.minPriceAUD)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.unitCount} available
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
