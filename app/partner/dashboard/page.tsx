"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePartner } from "@/lib/partner-context";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Clock,
  DollarSign,
  TrendingUp,
  Loader2,
  Search,
} from "lucide-react";
import { useFX } from "@/lib/use-fx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Stats {
  totalQuotes: number;
  activeQuotes: number;
  paidQuotes: number;
  commissionEarned: number;
  pendingPayout: number;
  recentActivity: RecentItem[];
}

interface RecentItem {
  id: string;
  type: "quote" | "bulkQuote";
  status: string;
  partnerMode: string | null;
  createdAt: string | null;
  // quote fields
  deviceId?: string;
  grade?: string;
  quotePriceNZD?: number;
  // bulkQuote fields
  deviceCount?: number;
  totalNZD?: number;
}

interface PriceLookupDevice {
  make: string;
  model: string;
  storage: string;
  category: string;
  grades: Record<string, number | null>;
}

interface PriceLookupResult {
  devices: PriceLookupDevice[];
  grades: { key: string; label: string }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerDashboardPage() {
  const router = useRouter();
  const { partner } = usePartner();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Price lookup state
  const [searchQuery, setSearchQuery] = useState("");
  const [lookupResult, setLookupResult] = useState<PriceLookupResult | null>(
    null
  );
  const [lookupLoading, setLookupLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/partner/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const { convert, formatPrice: fxFormatPrice } = useFX();
  const currency = partner?.currency ?? "AUD";
  const formatPrice = (price: number | null | undefined) => {
    return fxFormatPrice(price, currency);
  };

  const formatGradePrice = useCallback(
    (priceNZD: number | null) => {
      if (priceNZD == null) return "\u2014";
      const displayAmount = convert(priceNZD, currency);
      const locale = currency === "AUD" ? "en-AU" : "en-NZ";
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(displayAmount);
    },
    [convert, currency]
  );

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setLookupResult(null);
      setLookupLoading(false);
      return;
    }

    setLookupLoading(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/partner/prices?q=${encodeURIComponent(value.trim())}`)
        .then((res) => res.json())
        .then((data) => setLookupResult(data))
        .catch(console.error)
        .finally(() => setLookupLoading(false));
    }, 300);
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const statCards = [
    {
      label: "Total Quotes",
      value: stats?.totalQuotes ?? 0,
      icon: FileText,
      color: "text-blue-500",
    },
    {
      label: "Active Quotes",
      value: stats?.activeQuotes ?? 0,
      icon: Clock,
      color: "text-amber-500",
    },
    {
      label: "Commission Earned",
      value: formatPrice(stats?.commissionEarned),
      icon: DollarSign,
      color: "text-emerald-500",
      show: partner?.modes.includes("A"),
    },
    {
      label: "Pending Payout",
      value: formatPrice(stats?.pendingPayout),
      icon: TrendingUp,
      color: "text-violet-500",
      show: partner?.modes.includes("A"),
    },
  ].filter((card) => card.show !== false);

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, {partner?.name}
        </p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="mt-8 flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-border bg-card p-6"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </p>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <p className="mt-2 text-2xl font-bold">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Grading Guide */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold">Grading Guide</h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Grade</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold">A</TableCell>
                    <TableCell className="text-sm">Pristine</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">B</TableCell>
                    <TableCell className="text-sm">Good cosmetics, fully functional</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">C</TableCell>
                    <TableCell className="text-sm">Moderately used</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">D</TableCell>
                    <TableCell className="text-sm">Significant wear or damage, cracked screen or functional issues</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">E</TableCell>
                    <TableCell className="text-sm">Major or water damage, no power</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Price Lookup */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold">Price Lookup</h2>
            <div className="mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by model e.g. iPhone 15, Galaxy S24..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="mt-3 rounded-lg border border-border bg-card">
                {lookupLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !searchQuery.trim() || searchQuery.trim().length < 2 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Type a model name to look up prices.
                  </div>
                ) : lookupResult &&
                  lookupResult.devices.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No devices found matching &ldquo;{searchQuery.trim()}&rdquo;
                  </div>
                ) : lookupResult && lookupResult.devices.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Device</TableHead>
                          <TableHead>Storage</TableHead>
                          {lookupResult.grades.map((g) => (
                            <TableHead key={g.key} className="text-right">
                              {g.key}
                              <span className="ml-1 hidden text-xs font-normal text-muted-foreground sm:inline">
                                ({g.label})
                              </span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lookupResult.devices.map((device, idx) => (
                          <TableRow key={`${device.model}-${device.storage}-${idx}`}>
                            <TableCell className="font-medium">
                              {device.make} {device.model}
                            </TableCell>
                            <TableCell>{device.storage}</TableCell>
                            {lookupResult.grades.map((g) => (
                              <TableCell
                                key={g.key}
                                className="text-right tabular-nums"
                              >
                                {formatGradePrice(device.grades[g.key] ?? null)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <div className="mt-3 rounded-lg border border-border bg-card">
              {!stats?.recentActivity?.length ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No activity yet. Quotes attributed to you will appear here.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentActivity.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/partner/quotes/${item.id}`)
                        }
                      >
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.type === "quote" ? "Single" : "Bulk"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.partnerMode === "A"
                              ? "Referral"
                              : item.partnerMode === "B"
                                ? "Dealer"
                                : "\u2014"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.type === "quote"
                            ? `Grade ${item.grade ?? "?"} \u2014 ${formatPrice(item.quotePriceNZD)}`
                            : `${item.deviceCount ?? 0} devices \u2014 ${formatPrice(item.totalNZD)}`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "paid" ? "default" : "secondary"
                            }
                            className={
                              item.status === "paid"
                                ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80"
                                : ""
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
