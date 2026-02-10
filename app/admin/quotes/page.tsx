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

interface Quote {
  id: string;
  deviceId: string;
  deviceMake: string;
  deviceModel: string;
  deviceStorage: string;
  grade: string;
  quotePriceNZD: number;
  displayCurrency: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  partnerId: string | null;
  partnerName: string | null;
  partnerMode: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  inspectionGrade: string | null;
  revisedPriceNZD: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  "all",
  "quoted",
  "accepted",
  "shipped",
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
    case "quoted":
      return { variant: "default" };
    case "accepted":
      return { variant: "secondary" };
    case "shipped":
      return { variant: "outline" };
    case "received":
      return { variant: "secondary" };
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

export default function QuotesPage() {
  const router = useRouter();

  // ---- data state ---------------------------------------------------------
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- filter / search state ----------------------------------------------
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ---- pagination state ---------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);

  // ---- debounce search input ----------------------------------------------
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

  // ---- fetch quotes -------------------------------------------------------
  const fetchQuotes = useCallback(() => {
    setLoading(true);

    const params = new URLSearchParams();
    if (activeStatus !== "all") {
      params.set("status", activeStatus);
    }
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    const url = `/api/admin/quotes${params.toString() ? `?${params.toString()}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data: Quote[]) => {
        if (Array.isArray(data)) {
          setQuotes(data);
        }
      })
      .finally(() => setLoading(false));
  }, [activeStatus, debouncedSearch]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // ---- pagination ---------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(quotes.length / PAGE_SIZE));
  const paginatedQuotes = quotes.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // ---- helpers ------------------------------------------------------------
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

  // ---- render -------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading quotes..."
              : `${quotes.length} quote${quotes.length !== 1 ? "s" : ""} found`}
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

      {/* Search input */}
      <div className="mt-4 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or email..."
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
        ) : quotes.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {activeStatus !== "all" || debouncedSearch
              ? "No quotes match your filters."
              : "No quotes found."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote ID</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedQuotes.map((quote) => {
                const badgeProps = statusBadgeProps(quote.status);
                return (
                  <TableRow
                    key={quote.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/quotes/${quote.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      {quote.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>
                      {[quote.deviceMake, quote.deviceModel, quote.deviceStorage]
                        .filter(Boolean)
                        .join(" ") || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{quote.grade}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(quote.quotePriceNZD)}
                    </TableCell>
                    <TableCell>{quote.customerName || "\u2014"}</TableCell>
                    <TableCell>
                      {quote.partnerName ? (
                        <span
                          className="text-sm text-primary hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/partners/${quote.partnerId}`);
                          }}
                        >
                          {quote.partnerName}
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
                        {quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(quote.createdAt)}
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
