"use client";

import React, { useState, useEffect } from "react";
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
import { Loader2, DollarSign, TrendingUp, Clock } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EarningsItem {
  id: string;
  type: "commission" | "settlement" | "bulkSettlement";
  // Commission fields
  quoteId?: string | null;
  bulkQuoteId?: string | null;
  deviceCount?: number;
  quoteTotal?: number;
  commissionAmount?: number;
  status?: string;
  payoutId?: string | null;
  // Settlement fields
  quotePriceNZD?: number;
  grade?: string | null;
  // Bulk settlement fields
  totalIndicativeNZD?: number;
  totalDevices?: number;
  // Common
  createdAt: string | null;
}

interface EarningsData {
  items: EarningsItem[];
  totalCommissionEarned: number;
  totalCommissionPending: number;
  totalSettled: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerEarningsPage() {
  const { partner, loading: partnerLoading } = usePartner();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/partner/earnings")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (amount: number | null | undefined) => {
    if (amount == null) return "\u2014";
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
    }).format(amount);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (partnerLoading || !partner) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isModeA = partner.modes.includes("A");
  const isModeB = partner.modes.includes("B");

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Earnings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isModeA && "Commission earned from referrals"}
          {isModeA && isModeB && " and "}
          {isModeB && "settlement history for direct trade-ins"}
        </p>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isModeA && (
          <>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <p className="text-sm text-muted-foreground">
                  Commission Earned
                </p>
              </div>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {formatPrice(data?.totalCommissionEarned ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-muted-foreground">
                  Pending Commission
                </p>
              </div>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {formatPrice(data?.totalCommissionPending ?? 0)}
              </p>
            </div>
          </>
        )}
        {isModeB && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">Total Settled</p>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {formatPrice(data?.totalSettled ?? 0)}
            </p>
          </div>
        )}
      </div>

      {/* Earnings table */}
      <div className="mt-6 rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <span className="text-sm font-medium">Earnings History</span>
          <Badge variant="secondary" className="ml-2 text-xs">
            {data?.items.length ?? 0} entries
          </Badge>
        </div>

        {!data || data.items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No earnings yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.type === "commission"
                          ? "Commission"
                          : item.type === "settlement"
                          ? "Settlement"
                          : "Bulk Settlement"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.type === "commission" && (
                        <span className="text-muted-foreground">
                          {item.quoteId
                            ? `Quote ${item.quoteId.substring(0, 8)}`
                            : item.bulkQuoteId
                            ? `Bulk ${item.bulkQuoteId.substring(0, 8)}`
                            : "\u2014"}
                          {item.deviceCount
                            ? ` (${item.deviceCount} device${item.deviceCount !== 1 ? "s" : ""})`
                            : ""}
                        </span>
                      )}
                      {item.type === "settlement" && (
                        <span className="text-muted-foreground">
                          Quote {item.id.substring(0, 8)}
                          {item.grade ? ` \u2022 Grade ${item.grade}` : ""}
                        </span>
                      )}
                      {item.type === "bulkSettlement" && (
                        <span className="text-muted-foreground">
                          Bulk {item.id.substring(0, 8)}
                          {item.totalDevices
                            ? ` \u2022 ${item.totalDevices} devices`
                            : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.type === "commission"
                        ? formatPrice(item.commissionAmount)
                        : item.type === "settlement"
                        ? formatPrice(item.quotePriceNZD)
                        : formatPrice(item.totalIndicativeNZD)}
                    </TableCell>
                    <TableCell>
                      {item.type === "commission" && (
                        <Badge
                          variant={
                            item.status === "paid" ? "default" : "secondary"
                          }
                          className={
                            item.status === "paid"
                              ? "border-transparent bg-emerald-600 text-white text-xs"
                              : "text-xs"
                          }
                        >
                          {item.status}
                        </Badge>
                      )}
                      {(item.type === "settlement" ||
                        item.type === "bulkSettlement") && (
                        <Badge
                          variant="default"
                          className="border-transparent bg-emerald-600 text-white text-xs"
                        >
                          paid
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
