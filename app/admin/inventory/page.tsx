"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useFX } from "@/lib/use-fx";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryItem {
  id: string;
  inventoryId: number;
  deviceRef: string;
  deviceMake: string;
  deviceModel: string;
  deviceStorage: string;
  category: string;
  serial: string;
  sourceType: string;
  cosmeticGrade: string;
  costNZD: number;
  sellPriceNZD: number;
  status: string;
  listed: boolean;
  location: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CategoryInfo {
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  "all",
  "received",
  "inspecting",
  "refurbishing",
  "listed",
  "reserved",
  "sold",
  "parts_only",
] as const;

type StatusFilter = (typeof STATUSES)[number];

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

function inventoryStatusBadgeProps(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
} {
  switch (status) {
    case "received":
      return { variant: "secondary" };
    case "inspecting":
      return { variant: "outline" };
    case "refurbishing":
      return {
        variant: "outline",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "listed":
      return {
        variant: "default",
        className:
          "border-transparent bg-blue-600 text-white hover:bg-blue-600/80",
      };
    case "reserved":
      return {
        variant: "default",
        className:
          "border-transparent bg-purple-600 text-white hover:bg-purple-600/80",
      };
    case "sold":
      return {
        variant: "default",
        className:
          "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80",
      };
    case "parts_only":
      return { variant: "destructive" };
    default:
      return { variant: "outline" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const router = useRouter();

  // ---- data state ---------------------------------------------------------
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- category state -----------------------------------------------------
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  // ---- filter / search state ----------------------------------------------
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ---- pagination state ---------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);

  // ---- fetch categories on mount ------------------------------------------
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) {
          const cats = Object.keys(data.categories)
            .map((name) => ({ name }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setCategories(cats);
        }
      })
      .catch(() => {});
  }, []);

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
  }, [activeStatus, selectedCategory, debouncedSearch]);

  // ---- fetch inventory ----------------------------------------------------
  const fetchInventory = useCallback(() => {
    setLoading(true);

    const params = new URLSearchParams();
    if (activeStatus !== "all") {
      params.set("status", activeStatus);
    }
    if (selectedCategory) {
      params.set("category", selectedCategory);
    }
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    const url = `/api/admin/inventory${params.toString() ? `?${params.toString()}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data: InventoryItem[]) => {
        if (Array.isArray(data)) {
          setItems(data);
        }
      })
      .finally(() => setLoading(false));
  }, [activeStatus, selectedCategory, debouncedSearch]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // ---- pagination ---------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = items.slice(
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

  const { formatPrice: fxFormatPrice } = useFX();

  const formatPrice = (amount: number | null | undefined) => {
    return fxFormatPrice(amount, "AUD");
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ");
  };

  // ---- render -------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading inventory..."
              : `${items.length} item${items.length !== 1 ? "s" : ""} found`}
          </p>
        </div>
        <Link href="/admin/inventory/receive">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Receive from Quote
          </Button>
        </Link>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="mt-6 flex gap-1 border-b border-border">
          <button
            onClick={() => setSelectedCategory("")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              !selectedCategory
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                selectedCategory === cat.name
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Status filter pills */}
      <div className="mt-4 flex flex-wrap gap-2">
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
              {formatStatus(status)}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div className="mt-4 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by device or serial..."
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
              Loading inventory...
            </span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {activeStatus !== "all" || selectedCategory || debouncedSearch
              ? "No items match your filters."
              : "No inventory items yet. Receive your first device from a quote."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inv ID</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Sell Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => {
                const badgeProps = inventoryStatusBadgeProps(item.status);
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/admin/inventory/${item.id}`)
                    }
                  >
                    <TableCell className="font-mono text-xs">
                      {item.inventoryId}
                    </TableCell>
                    <TableCell>
                      {[item.deviceMake, item.deviceModel, item.deviceStorage]
                        .filter(Boolean)
                        .join(" ") || "\u2014"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.serial}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.cosmeticGrade}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(item.costNZD)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(item.sellPriceNZD)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={badgeProps.variant}
                        className={badgeProps.className}
                      >
                        {formatStatus(item.status)}
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
            {Math.min(currentPage * PAGE_SIZE, items.length)} of {items.length}
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
