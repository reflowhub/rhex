"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePartner } from "@/lib/partner-context";
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
import { useFX } from "@/lib/use-fx";
import {
  QUOTE_STATUSES,
  quoteStatusBadge,
  quoteStatusLabel,
  type QuoteStatusBadge,
} from "@/lib/quote-status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteItem {
  id: string;
  type: "quote" | "bulkQuote";
  // Single quote fields
  deviceMake?: string;
  deviceModel?: string;
  deviceStorage?: string;
  grade?: string;
  quotePriceNZD?: number;
  publicPriceNZD?: number | null;
  // Bulk quote fields
  deviceCount?: number;
  totalNZD?: number | null;
  // Common fields
  status: string;
  partnerMode: string | null;
  customerName: string | null;
  customerEmail: string | null;
  createdAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Single-quote statuses plus "estimated" (bulk quotes only)
const STATUSES = [
  "all",
  "quoted",
  "estimated",
  ...QUOTE_STATUSES.filter((s) => s !== "quoted"),
] as const;

type StatusFilter = (typeof STATUSES)[number];

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

function statusBadgeProps(status: string): QuoteStatusBadge {
  return status === "estimated" ? { variant: "default" } : quoteStatusBadge(status);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerQuotesPage() {
  const router = useRouter();
  const { partner, loading: partnerLoading } = usePartner();

  // Data state
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter / search state
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeStatus, debouncedSearch]);

  // Fetch quotes
  const fetchQuotes = useCallback(() => {
    setLoading(true);

    const params = new URLSearchParams();
    if (activeStatus !== "all") {
      params.set("status", activeStatus);
    }
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    const url = `/api/partner/quotes${params.toString() ? `?${params.toString()}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(data);
        }
      })
      .finally(() => setLoading(false));
  }, [activeStatus, debouncedSearch]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = items.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Helpers
  const formatDate = (iso: string | null) => {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const { formatPrice: fxFormatPrice } = useFX();
  const formatPrice = (amount: number | null | undefined) => {
    return fxFormatPrice(amount, partner?.currency ?? "AUD");
  };

  const handleRowClick = (item: QuoteItem) => {
    if (item.type === "bulkQuote") {
      router.push(`/partner/estimate/${item.id}`);
    } else {
      router.push(`/partner/quotes/${item.id}`);
    }
  };

  if (partnerLoading || !partner) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading quotes..."
              : `${items.length} item${items.length !== 1 ? "s" : ""} found`}
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
              {status === "all" ? "All" : quoteStatusLabel(status, "public")}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div className="mt-4 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by device or customer..."
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
              Loading quotes...
            </span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {activeStatus !== "all" || debouncedSearch
              ? "No quotes match your filters."
              : "No quotes found."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => {
                const badgeProps = statusBadgeProps(item.status);
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(item)}
                  >
                    <TableCell className="font-mono text-xs">
                      {item.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.type === "bulkQuote" ? "Bulk" : "Single"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.type === "quote"
                        ? [item.deviceMake, item.deviceModel, item.deviceStorage]
                            .filter(Boolean)
                            .join(" ") || "\u2014"
                        : `${item.deviceCount ?? 0} devices`}
                    </TableCell>
                    <TableCell>
                      {item.grade ? (
                        <Badge variant="outline">{item.grade}</Badge>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.type === "quote"
                        ? formatPrice(item.quotePriceNZD)
                        : formatPrice(item.totalNZD)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={badgeProps.variant}
                        className={badgeProps.className}
                      >
                        {quoteStatusLabel(item.status, "public")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          item.partnerMode === "A"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        }`}
                      >
                        {item.partnerMode === "A" ? "Referral" : "Direct"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!loading && items.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
            {Math.min(currentPage * PAGE_SIZE, items.length)} of{" "}
            {items.length}
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
