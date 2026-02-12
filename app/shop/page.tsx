"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Smartphone, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShopProduct {
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

interface CategoryInfo {
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 24;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShopPage() {
  const { currency, convertFromAUD } = useCurrency();

  // ---- data state ---------------------------------------------------------
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // ---- category state -----------------------------------------------------
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  // ---- pagination state ---------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);

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

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);

  // ---- fetch products -----------------------------------------------------
  const fetchProducts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory);
    params.set("page", String(currentPage));
    params.set("limit", String(PAGE_SIZE));

    const url = `/api/shop/products${params.toString() ? `?${params.toString()}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.items) {
          setProducts(data.items);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedCategory, currentPage]);

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
    <div>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Shop</h1>
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
        ) : products.length === 0 ? (
          <div className="py-20 text-center">
            <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              No devices available right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link key={product.id} href={`/shop/${product.id}`}>
                <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20">
                  {/* Image area */}
                  <div className="aspect-square w-full overflow-hidden rounded bg-background">
                    {product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={`${product.make} ${product.model}`}
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
                      {product.make}
                    </p>
                    <p className="font-medium text-foreground">
                      {product.model} {product.storage}
                    </p>
                    <span className="inline-block rounded bg-background px-2 py-0.5 text-xs font-medium text-foreground">
                      Grade {product.cosmeticGrade}
                    </span>
                    <p className="text-lg font-medium tabular-nums text-foreground">
                      {formatPrice(product.sellPriceAUD)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} device{total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous page</span>
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
