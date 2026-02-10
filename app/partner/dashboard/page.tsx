"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePartner } from "@/lib/partner-context";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerDashboardPage() {
  const router = useRouter();
  const { partner } = usePartner();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/partner/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (price: number | null | undefined) => {
    if (price == null) return "\u2014";
    return `$${price.toFixed(2)}`;
  };

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
                                ? "Hands-On"
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
