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
import { Loader2, CreditCard, Clock } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Payout {
  id: string;
  amount: number;
  reference: string | null;
  paymentMethod: string | null;
  ledgerEntryCount: number;
  createdAt: string | null;
}

interface PayoutsData {
  payouts: Payout[];
  pendingBalance: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerPayoutsPage() {
  const { partner, loading: partnerLoading } = usePartner();
  const [data, setData] = useState<PayoutsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/partner/payouts")
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

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Payout history and pending balance
        </p>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-muted-foreground">Pending Balance</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {formatPrice(data?.pendingBalance ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Accumulated commission awaiting payout
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <p className="text-sm text-muted-foreground">Total Payouts</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {formatPrice(
              data?.payouts.reduce((sum, p) => sum + p.amount, 0) ?? 0
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data?.payouts.length ?? 0} payout
            {(data?.payouts.length ?? 0) !== 1 ? "s" : ""} processed
          </p>
        </div>
      </div>

      {/* Payouts table */}
      <div className="mt-6 rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <span className="text-sm font-medium">Payout History</span>
        </div>

        {!data || data.payouts.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No payouts yet. Commission payments will appear here once processed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payout ID</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-xs">
                      {payout.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatPrice(payout.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {payout.ledgerEntryCount} entries
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {payout.paymentMethod === "payid"
                        ? "PayID"
                        : payout.paymentMethod === "bank_transfer"
                        ? "Bank Transfer"
                        : payout.paymentMethod || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payout.reference || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(payout.createdAt)}
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
