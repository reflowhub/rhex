"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PriceListMeta {
  id: string;
  name: string;
  effectiveDate: string | null;
  currency: string;
  deviceCount: number;
  createdAt: string | null;
}

interface PriceEntry {
  deviceId: string;
  make: string;
  model: string;
  storage: string;
  grades: Record<string, number>;
  // Legacy fields (populated by API for backward compat)
  gradeA: number;
  gradeB: number;
  gradeC: number;
  gradeD: number;
  gradeE: number;
}

const GRADE_KEYS = ["A", "B", "C", "D", "E"];

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PriceListDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  // ---- data state ---------------------------------------------------------
  const [priceList, setPriceList] = useState<PriceListMeta | null>(null);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- search state -------------------------------------------------------
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // ---- pagination state ---------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);

  // ---- debounced search ---------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ---- fetch data ---------------------------------------------------------
  const fetchData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/pricing/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setPriceList(data.priceList);
        setPrices(data.prices ?? []);
      })
      .catch(() => {
        setPriceList(null);
        setPrices([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- filtered + paginated data ------------------------------------------
  const filteredPrices = useMemo(() => {
    if (!searchTerm) return prices;
    const words = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    return prices.filter((p) => {
      const combined =
        `${p.deviceId} ${p.make} ${p.model} ${p.storage}`.toLowerCase();
      return words.every((word) => combined.includes(word));
    });
  }, [prices, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPrices.length / PAGE_SIZE));
  const paginatedPrices = filteredPrices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // ---- helpers ------------------------------------------------------------
  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString("en-NZ")}`;
  };

  // ---- render: loading ----------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading price list...
        </span>
      </div>
    );
  }

  // ---- render: not found --------------------------------------------------
  if (!priceList) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Price list not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/pricing")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Price Lists
        </Button>
      </div>
    );
  }

  // ---- render: main -------------------------------------------------------
  return (
    <div>
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/pricing")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Price Lists
      </Button>

      {/* Header with metadata */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {priceList.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Effective: {formatDate(priceList.effectiveDate)}</span>
            <Badge variant="secondary">{priceList.currency}</Badge>
            <span>{priceList.deviceCount} devices</span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by device ID, make, model, or storage..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Prices table */}
      <div className="mt-6 rounded-lg border border-border bg-card">
        {paginatedPrices.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {searchTerm
              ? "No devices match your search."
              : "No pricing data found."}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Device ID</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Storage</TableHead>
                  {GRADE_KEYS.map((g) => (
                    <TableHead key={g} className="text-right">
                      Grade {g}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPrices.map((price) => (
                  <TableRow key={price.deviceId}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {price.deviceId}
                    </TableCell>
                    <TableCell className="font-medium">{price.make}</TableCell>
                    <TableCell>{price.model}</TableCell>
                    <TableCell>{price.storage}</TableCell>
                    {GRADE_KEYS.map((g) => (
                      <TableCell key={g} className="text-right">
                        {formatCurrency(price.grades?.[g] ?? 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium">
                    {(currentPage - 1) * PAGE_SIZE + 1}
                  </span>
                  {" - "}
                  <span className="font-medium">
                    {Math.min(
                      currentPage * PAGE_SIZE,
                      filteredPrices.length
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium">
                    {filteredPrices.length}
                  </span>{" "}
                  devices
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(totalPages, prev + 1)
                      )
                    }
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
