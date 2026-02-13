"use client";

import { Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCurrency } from "@/lib/currency-context";
import { CartProvider, useCart } from "@/lib/cart-context";
import { ThemeToggle } from "@/components/theme-toggle";
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
  const { currency } = useCurrency();
  const pathname = usePathname();
  const { itemCount } = useCart();
  const [nzTooltip, setNzTooltip] = useState(false);

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
          <Link href="/buy" className="flex items-center gap-2.5">
            <Image
              src="/logo-rhex.svg"
              alt="rhex"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span className="text-xl font-bold tracking-tight">rhex</span>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/sell"
              className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Trade In
            </Link>
            <Link
              href="/buy"
              className={cn(
                "text-sm font-medium transition-colors",
                pathname === "/buy" || pathname.startsWith("/buy/")
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Shop
            </Link>

            {/* Currency switcher */}
            <div className="relative flex items-center rounded-lg border border-border bg-background p-0.5 text-xs font-medium">
              <button
                className="rounded-md px-2 py-1 bg-primary text-primary-foreground"
              >
                AUD
              </button>
              <button
                onClick={() => {
                  setNzTooltip(true);
                  setTimeout(() => setNzTooltip(false), 2000);
                }}
                className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                NZD
              </button>
              {nzTooltip && (
                <div className="absolute top-full right-0 mt-1.5 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md">
                  NZ shop coming soon
                </div>
              )}
            </div>

            <ThemeToggle />

            {/* Cart icon */}
            <Link
              href="/buy/cart"
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
              href="/sell"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors sm:hidden"
            >
              Trade In
            </Link>
            <Link
              href="/terms"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/warranty"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Warranty &amp; Returns
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

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/61426908433"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110"
        style={{ backgroundColor: "#25D366" }}
      >
        <svg
          viewBox="0 0 32 32"
          fill="white"
          className="h-7 w-7"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16.004 2.003A13.934 13.934 0 0 0 2.05 15.998a13.86 13.86 0 0 0 1.888 7.003L2 30l7.2-1.895A13.94 13.94 0 0 0 16.004 30 13.998 13.998 0 0 0 16.004 2.003Zm0 25.57a11.53 11.53 0 0 1-5.903-1.618l-.424-.252-4.39 1.154 1.174-4.293-.276-.44a11.56 11.56 0 1 1 9.819 5.45Zm6.336-8.652c-.348-.174-2.058-1.016-2.377-1.132-.319-.116-.551-.174-.783.174-.232.348-.899 1.132-1.102 1.364-.203.232-.406.261-.754.087-.348-.174-1.469-.541-2.798-1.725-1.034-.921-1.732-2.059-1.935-2.407-.203-.348-.022-.536.152-.71.157-.156.348-.406.522-.609.174-.203.232-.348.348-.58.116-.232.058-.435-.029-.609-.087-.174-.783-1.886-1.073-2.583-.283-.678-.57-.586-.783-.597l-.667-.012a1.279 1.279 0 0 0-.928.435c-.319.348-1.218 1.19-1.218 2.902s1.247 3.367 1.421 3.599c.174.232 2.454 3.748 5.946 5.254.831.359 1.479.573 1.985.734.834.265 1.593.228 2.193.138.669-.1 2.058-.841 2.348-1.654.29-.812.29-1.509.203-1.654-.087-.145-.319-.232-.667-.406Z" />
        </svg>
      </a>
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
