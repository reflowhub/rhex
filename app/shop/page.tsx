"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Smartphone,
  Watch,
  Tablet,
  CheckCircle,
  Battery,
  Shield,
  Leaf,
  DollarSign,
  Cpu,
  ArrowRight,
} from "lucide-react";
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
  images: string[];
}

interface CategoryInfo {
  name: string;
}

// ---------------------------------------------------------------------------
// Category icon mapping
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Phone: Smartphone,
  Watch: Watch,
  Tablet: Tablet,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShopHomePage() {
  const { currency, convertFromAUD } = useCurrency();

  const [featured, setFeatured] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  // Fetch featured products + categories on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch("/api/shop/products?limit=4"),
          fetch("/api/categories"),
        ]);

        const productsData = await productsRes.json();
        if (productsData.items) {
          setFeatured(productsData.items);
        }

        const categoriesData = await categoriesRes.json();
        if (Array.isArray(categoriesData)) {
          setCategories(
            categoriesData.map((c: { name: string }) => ({ name: c.name }))
          );

          // Fetch counts per category
          const counts: Record<string, number> = {};
          await Promise.all(
            categoriesData.map(async (c: { name: string }) => {
              const res = await fetch(
                `/api/shop/products?category=${c.name}&limit=1`
              );
              const data = await res.json();
              counts[c.name] = data.total ?? 0;
            })
          );
          setCategoryCounts(counts);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  return (
    <div className="-mx-4 -mt-8">
      {/* ================================================================= */}
      {/* Hero                                                              */}
      {/* ================================================================= */}
      <section className="px-4 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Certified Refurbished
            <br />
            Devices
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Every device individually tested, graded, and photographed. You see
            exactly what you get.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/shop/browse"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Browse Devices
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
            >
              Trade In Your Device
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Trust Signals                                                     */}
      {/* ================================================================= */}
      <section className="border-y border-border bg-muted/60 px-4 py-16">
        <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-3">
          {[
            {
              icon: CheckCircle,
              title: "Individually Tested",
              desc: "Every device passes a comprehensive functional check before listing.",
            },
            {
              icon: Battery,
              title: "Battery Health Verified",
              desc: "Actual battery health percentage reported — no guesswork.",
            },
            {
              icon: Shield,
              title: "90-Day Warranty",
              desc: "Full warranty on every device. If something's wrong, we make it right.",
            },
          ].map((item) => (
            <div key={item.title} className="text-center sm:text-left">
              <item.icon
                className="mx-auto h-6 w-6 text-muted-foreground sm:mx-0"
                strokeWidth={1.5}
              />
              <h3 className="mt-4 text-sm font-medium tracking-wide text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* Featured Products (hidden when empty)                              */}
      {/* ================================================================= */}
      {!loading && featured.length > 0 && (
        <section className="px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                  Latest Arrivals
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Recently listed devices, ready to ship.
                </p>
              </div>
              <Link
                href="/shop/browse"
                className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex sm:items-center sm:gap-1"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-10">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {featured.map((product) => (
                  <Link key={product.id} href={`/shop/${product.id}`}>
                    <div className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-foreground/20">
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
                      <div className="mt-4 space-y-1">
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
            </div>

            <Link
              href="/shop/browse"
              className="mt-8 flex items-center justify-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:hidden"
            >
              View all devices
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* Browse by Category                                                */}
      {/* ================================================================= */}
      {categories.length > 0 && (
        <section className="border-t border-border bg-muted/60 px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Browse by Category
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Find exactly what you&apos;re looking for.
            </p>

            <div
              className={cn(
                "mt-10 grid gap-4",
                categories.length === 1
                  ? "grid-cols-1 max-w-sm"
                  : categories.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              )}
            >
              {categories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.name] ?? Smartphone;
                const count = categoryCounts[cat.name] ?? 0;
                return (
                  <Link
                    key={cat.name}
                    href={`/shop/browse?category=${cat.name}`}
                  >
                    <div className="group flex items-center gap-6 rounded-lg border border-border bg-background p-8 transition-colors hover:border-foreground/20">
                      <Icon
                        className="h-10 w-10 shrink-0 text-muted-foreground"
                        strokeWidth={1}
                      />
                      <div>
                        <h3 className="text-lg font-medium text-foreground">
                          {cat.name}
                        </h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {count} {count === 1 ? "device" : "devices"} available
                        </p>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* Why Buy Refurbished                                               */}
      {/* ================================================================= */}
      <section className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Why Refurbished
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Same performance. Smarter purchase.
          </p>

          <div className="mt-10 grid gap-12 sm:grid-cols-3">
            {[
              {
                icon: DollarSign,
                title: "Save 30–50%",
                desc: "Premium devices at a fraction of retail. Every dollar saved is a dollar earned.",
              },
              {
                icon: Leaf,
                title: "Reduce E-Waste",
                desc: "Extend a device's life instead of adding to landfill. Good for you, good for the planet.",
              },
              {
                icon: Cpu,
                title: "Full Performance",
                desc: "Professionally refurbished to factory standards. Tested, verified, ready to go.",
              },
            ].map((item) => (
              <div key={item.title}>
                <item.icon
                  className="h-6 w-6 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <h3 className="mt-4 text-sm font-medium tracking-wide text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Bottom CTA                                                        */}
      {/* ================================================================= */}
      <section className="border-t border-border bg-muted/60 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Ready to find your next device?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Every device is individually graded and photographed. What you see is
            what you get.
          </p>
          <Link
            href="/shop/browse"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse All Devices
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
