"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Smartphone, Loader2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/lib/currency-context";
import { GRADE_LABELS } from "@/lib/grades";
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
  fallbackImage: string | null;
}

interface ProductItem {
  id: string;
  make: string;
  model: string;
  storage: string;
  category: string;
  cosmeticGrade: string;
  batteryHealth: number | null;
  sellPriceAUD: number;
  images: string[];
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
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- category state -----------------------------------------------------
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const isAllTab = !selectedCategory;

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

  // ---- fetch products (individual for "All", grouped for categories) ------
  const fetchProducts = useCallback(() => {
    setLoading(true);

    if (isAllTab) {
      // Fetch individual items
      fetch("/api/buy/products?limit=48")
        .then((res) => res.json())
        .then((data) => {
          if (data.items) {
            setItems(data.items);
          }
        })
        .finally(() => setLoading(false));
    } else {
      // Fetch grouped by model
      const url = `/api/buy/products/grouped?category=${encodeURIComponent(selectedCategory)}`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.groups) {
            setGroups(data.groups);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [selectedCategory, isAllTab]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Browse Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Certified refurbished devices, individually graded and photographed.
          </p>
        </div>
        <Link
          href="/buy/quiz"
          className="hidden items-center gap-1 whitespace-nowrap rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground sm:inline-flex"
        >
          Need help deciding?
          <ArrowRight className="h-3 w-3" />
        </Link>
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
        ) : isAllTab ? (
          /* ---- Individual items for "All" tab ---- */
          items.length === 0 ? (
            <div className="py-20 text-center">
              <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                No devices available right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Link key={item.id} href={`/buy/${item.id}`}>
                  <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20">
                    {/* Image */}
                    <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded bg-background p-4">
                      {item.images.length > 0 ? (
                        <img
                          src={item.images[0]}
                          alt={`${item.make} ${item.model} ${item.storage}`}
                          className="max-h-full max-w-full object-contain"
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
                        {item.make}
                      </p>
                      <p className="font-medium text-foreground">
                        {item.model}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {item.storage}
                        </p>
                        {item.cosmeticGrade && (
                          <Badge variant="secondary" className="text-xs">
                            Grade {item.cosmeticGrade}
                            {GRADE_LABELS[item.cosmeticGrade]
                              ? ` · ${GRADE_LABELS[item.cosmeticGrade]}`
                              : ""}
                          </Badge>
                        )}
                      </div>
                      {item.batteryHealth != null && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>Battery {item.batteryHealth}%</span>
                        </div>
                      )}
                      <p className="text-lg font-medium tabular-nums text-foreground pt-1">
                        {formatPrice(item.sellPriceAUD)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          /* ---- Grouped model families for category tabs ---- */
          groups.length === 0 ? (
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
                    <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded bg-background p-4">
                      {group.heroImage ? (
                        <img
                          src={group.heroImage}
                          alt={`${group.make} ${group.model}`}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (group.fallbackImage && img.src !== group.fallbackImage) {
                              img.src = group.fallbackImage;
                            } else {
                              img.style.display = "none";
                              img.parentElement?.classList.add("flex", "items-center", "justify-center");
                              const icon = document.createElement("div");
                              icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>';
                              img.parentElement?.appendChild(icon);
                            }
                          }}
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
          )
        )}
      </div>
    </div>
  );
}
