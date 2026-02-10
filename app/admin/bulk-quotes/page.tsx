"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BulkQuote {
  id: string;
  businessName: string | null;
  contactEmail: string | null;
  type: string;
  assumedGrade: string;
  totalDevices: number;
  totalIndicativeNZD: number;
  matchedCount: number;
  unmatchedCount: number;
  status: string;
  partnerId: string | null;
  partnerName: string | null;
  partnerMode: string | null;
  createdAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  "all",
  "estimated",
  "accepted",
  "received",
  "inspected",
  "paid",
  "cancelled",
] as const;

type StatusFilter = (typeof STATUSES)[number];

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

function statusBadgeProps(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
} {
  switch (status) {
    case "estimated":
      return { variant: "default" };
    case "accepted":
      return { variant: "secondary" };
    case "received":
      return { variant: "outline" };
    case "inspected":
      return { variant: "default" };
    case "paid":
      return {
        variant: "default",
        className:
          "border-transparent bg-green-600 text-white hover:bg-green-600/80",
      };
    case "cancelled":
      return { variant: "destructive" };
    default:
      return { variant: "outline" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BulkQuotesPage() {
  const router = useRouter();

  const [quotes, setQuotes] = useState<BulkQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeStatus, debouncedSearch]);

  // Fetch bulk quotes
  const fetchQuotes = useCallback(() => {
    setLoading(true);

    const params = new URLSearchParams();
    if (activeStatus !== "all") params.set("status", activeStatus);
    if (debouncedSearch) params.set("search", debouncedSearch);

    const url = `/api/admin/bulk-quotes${params.toString() ? `?${params.toString()}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data: BulkQuote[]) => {
        if (Array.isArray(data)) setQuotes(data);
      })
      .finally(() => setLoading(false));
  }, [activeStatus, debouncedSearch]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(quotes.length / PAGE_SIZE));
  const paginatedQuotes = quotes.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (amount: number | null | undefined) => {
    if (amount == null) return "\u2014";
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
    }).format(amount);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Quotes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading bulk quotes..."
              : `${quotes.length} bulk quote${quotes.length !== 1 ? "s" : ""} found`}
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map((status) => {
          const isActive = activeStatus === status;
          return (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {status}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mt-4 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by business name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading bulk quotes...
            </span>
          </div>
        ) : quotes.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {activeStatus !== "all" || debouncedSearch
              ? "No bulk quotes match your filters."
              : "No bulk quotes found."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Devices</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedQuotes.map((q) => {
                const badgeProps = statusBadgeProps(q.status);
                return (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/bulk-quotes/${q.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {q.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>{q.businessName || "\u2014"}</TableCell>
                    <TableCell className="capitalize">{q.type}</TableCell>
                    <TableCell className="text-right">
                      {q.totalDevices}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(q.totalIndicativeNZD)}
                    </TableCell>
                    <TableCell>
                      {q.partnerName ? (
                        <span
                          className="text-sm text-primary hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/partners/${q.partnerId}`);
                          }}
                        >
                          {q.partnerName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">\u2014</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={badgeProps.variant}
                        className={badgeProps.className}
                      >
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(q.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!loading && quotes.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
            {Math.min(currentPage * PAGE_SIZE, quotes.length)} of{" "}
            {quotes.length}
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
