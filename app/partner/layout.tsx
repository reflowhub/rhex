"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PartnerProvider, usePartner } from "@/lib/partner-context";
import {
  LayoutDashboard,
  Link2,
  Smartphone,
  Package,
  FileText,
  DollarSign,
  CreditCard,
  Settings,
  Menu,
  X,
  LogOut,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Sidebar link definitions — filtered by partner modes at render time
// ---------------------------------------------------------------------------

const allSidebarLinks = [
  {
    href: "/partner/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    modes: ["A", "B"],
  },
  {
    href: "/partner/referrals",
    label: "Referral Link",
    icon: Link2,
    modes: ["A"],
  },
  {
    href: "/partner/submit",
    label: "Submit Trade-In",
    icon: Smartphone,
    modes: ["B"],
  },
  {
    href: "/partner/estimate",
    label: "Bulk Estimate",
    icon: Package,
    modes: ["B"],
  },
  {
    href: "/partner/quotes",
    label: "Quotes",
    icon: FileText,
    modes: ["A", "B"],
  },
  {
    href: "/partner/earnings",
    label: "Earnings",
    icon: DollarSign,
    modes: ["A", "B"],
  },
  {
    href: "/partner/payouts",
    label: "Payouts",
    icon: CreditCard,
    modes: ["A", "B"],
  },
  {
    href: "/partner/settings",
    label: "Settings",
    icon: Settings,
    modes: ["A", "B"],
  },
];

// ---------------------------------------------------------------------------
// Inner layout (needs partner context)
// ---------------------------------------------------------------------------

function PartnerLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { partner, loading, logout } = usePartner();

  // Filter sidebar links based on partner's modes
  const sidebarLinks = partner
    ? allSidebarLinks.filter((link) =>
        link.modes.some((m) => partner.modes.includes(m))
      )
    : [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!partner) return null;

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
          <Link
            href="/partner/dashboard"
            className="text-xl font-bold tracking-tight"
          >
            Partner Portal
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        {/* Partner name */}
        <div className="border-b border-sidebar-border px-6 py-3">
          <p className="text-sm font-medium">{partner.name}</p>
          <p className="text-xs text-sidebar-foreground/50 font-mono">
            {partner.code}
          </p>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {sidebarLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <link.icon className="h-5 w-5 shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-sidebar-border px-3 py-4 space-y-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs text-sidebar-foreground/50">Theme</span>
            <ThemeToggle />
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open sidebar</span>
            </Button>
            <span className="ml-3 text-lg font-semibold">Partner Portal</span>
          </div>
          <ThemeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported layout — wraps in PartnerProvider
// ---------------------------------------------------------------------------

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Login page renders without the auth-guarded sidebar layout
  if (pathname === "/partner/login") {
    return <>{children}</>;
  }

  return (
    <PartnerProvider>
      <PartnerLayoutInner>{children}</PartnerLayoutInner>
    </PartnerProvider>
  );
}
