"use client";

import { Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useCurrency } from "@/lib/currency-context";
import { CartProvider, useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Font
// ---------------------------------------------------------------------------

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-shop",
});

// ---------------------------------------------------------------------------
// Inner layout (needs CartProvider to be above it for useCart)
// ---------------------------------------------------------------------------

function ShopLayoutInner({ children }: { children: React.ReactNode }) {
  const { currency, setCurrency } = useCurrency();
  const pathname = usePathname();
  const { itemCount } = useCart();

  return (
    <div
      className={cn("shop-theme min-h-screen bg-background", inter.variable)}
      style={{
        fontFamily:
          "var(--font-shop), 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-rhex.svg"
              alt="rhex"
              width={28}
              height={28}
              className="h-7 w-7"
            />
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Trade In
            </Link>
            <Link
              href="/shop"
              className={cn(
                "text-sm font-medium transition-colors",
                pathname === "/shop" || pathname.startsWith("/shop/")
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Shop
            </Link>

            {/* Currency switcher */}
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-xs font-medium">
              <button
                onClick={() => setCurrency("AUD")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  currency === "AUD"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                AUD
              </button>
              <button
                onClick={() => setCurrency("NZD")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  currency === "NZD"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                NZD
              </button>
            </div>

            {/* Cart icon */}
            <Link
              href="/shop/cart"
              className="relative text-muted-foreground hover:text-foreground transition-colors"
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo-rhex.svg"
              alt="rhex"
              width={20}
              height={20}
              className="h-5 w-5 opacity-40"
            />
            <span className="text-xs text-muted-foreground">
              Reflow Hub Pty Ltd
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/terms"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout wrapper — provides CartProvider above ShopLayoutInner
// ---------------------------------------------------------------------------

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <ShopLayoutInner>{children}</ShopLayoutInner>
    </CartProvider>
  );
}
