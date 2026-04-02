"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useFX } from "@/lib/use-fx";
import { GRADES, SELL_GRADE_LABELS } from "@/lib/grades";

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
  imei: string | null;
  partnerId: string | null;
  partnerName: string | null;
  partnerMode: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  inspectionGrade: string | null;
  revisedPriceNZD: number | null;
}

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface Partner {
  id: string;
  name: string;
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

  // ---- create dialog state ------------------------------------------------
  const [createOpen, setCreateOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("");
  const [imeiInput, setImeiInput] = useState("");
  const [currency, setCurrency] = useState<"AUD" | "NZD">("AUD");
  const [pricePreview, setPricePreview] = useState<{
    quotePriceNZD: number;
    quotePriceAUD: number;
  } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
  const deviceSearchRef = useRef<HTMLInputElement>(null);

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

  // ---- fetch devices & partners for create dialog -------------------------
  useEffect(() => {
    if (!createOpen) return;
    fetch("/api/admin/devices")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDevices(data);
      });
    fetch("/api/admin/partners?status=active")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data))
          setPartners(data.map((p: Record<string, unknown>) => ({ id: p.id as string, name: p.name as string })));
      });
  }, [createOpen]);

  // ---- price lookup when device + grade selected --------------------------
  useEffect(() => {
    if (!selectedDevice || !selectedGrade) {
      setPricePreview(null);
      return;
    }
    setPriceLoading(true);
    fetch(
      `/api/admin/quotes/price?deviceId=${selectedDevice.id}&grade=${selectedGrade}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.quotePriceNZD !== undefined) {
          setPricePreview({
            quotePriceNZD: data.quotePriceNZD,
            quotePriceAUD: data.quotePriceAUD,
          });
        } else {
          setPricePreview(null);
        }
      })
      .catch(() => setPricePreview(null))
      .finally(() => setPriceLoading(false));
  }, [selectedDevice, selectedGrade]);

  // ---- create quote handler -----------------------------------------------
  const resetCreateForm = () => {
    setDeviceSearch("");
    setSelectedDevice(null);
    setSelectedGrade("");
    setSelectedPartner("");
    setImeiInput("");
    setCurrency("AUD");
    setPricePreview(null);
    setFormError(null);
    setDeviceDropdownOpen(false);
  };

  const handleCreate = async () => {
    if (!selectedDevice || !selectedGrade) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          grade: selectedGrade,
          imei: imeiInput || undefined,
          partnerId: selectedPartner && selectedPartner !== "none" ? selectedPartner : undefined,
          displayCurrency: currency,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        resetCreateForm();
        fetchQuotes();
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to create quote");
      }
    } catch {
      setFormError("Failed to create quote");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- device search filtering --------------------------------------------
  const filteredDevices = deviceSearch.trim()
    ? devices.filter((d) => {
        const combined =
          `${d.make} ${d.model} ${d.storage}`.toLowerCase();
        return deviceSearch
          .toLowerCase()
          .split(/\s+/)
          .every((w) => combined.includes(w));
      })
    : devices;

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

  const { formatPrice: fxFormatPrice } = useFX();

  const formatPrice = (amount: number | null | undefined) => {
    return fxFormatPrice(amount, "AUD");
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
        <Button
          onClick={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Quote
        </Button>
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
                <TableHead>IMEI</TableHead>
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
                    <TableCell className="font-mono text-xs uppercase">
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
                    <TableCell className="font-mono text-xs">
                      {quote.imei || "\u2014"}
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
                        <span className="text-muted-foreground">{"\u2014"}</span>
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

      {/* Create Quote Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Quote</DialogTitle>
            <DialogDescription>
              Create a new trade-in quote for a device.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Device search */}
            <div className="grid gap-2">
              <Label>Device *</Label>
              {selectedDevice ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">
                    {selectedDevice.make} {selectedDevice.model}{" "}
                    {selectedDevice.storage}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs"
                    onClick={() => {
                      setSelectedDevice(null);
                      setDeviceSearch("");
                      setPricePreview(null);
                      setTimeout(() => deviceSearchRef.current?.focus(), 0);
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    ref={deviceSearchRef}
                    placeholder="Search devices..."
                    value={deviceSearch}
                    onChange={(e) => {
                      setDeviceSearch(e.target.value);
                      setDeviceDropdownOpen(true);
                    }}
                    onFocus={() => setDeviceDropdownOpen(true)}
                    onBlur={() =>
                      setTimeout(() => setDeviceDropdownOpen(false), 200)
                    }
                  />
                  {deviceDropdownOpen && filteredDevices.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
                      {filteredDevices.slice(0, 50).map((d) => (
                        <button
                          key={d.id}
                          className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-accent"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedDevice(d);
                            setDeviceSearch("");
                            setDeviceDropdownOpen(false);
                          }}
                        >
                          {d.make} {d.model} {d.storage}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Grade */}
            <div className="grid gap-2">
              <Label>Grade *</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g} &mdash; {SELL_GRADE_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price preview */}
            {(pricePreview || priceLoading) && (
              <div className="rounded-md border bg-muted/50 px-3 py-2">
                {priceLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Looking up price...
                  </div>
                ) : pricePreview ? (
                  <div className="text-sm">
                    <span className="font-medium">
                      ${pricePreview.quotePriceAUD.toFixed(2)} AUD
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      (${pricePreview.quotePriceNZD.toFixed(2)} NZD)
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {/* IMEI */}
            <div className="grid gap-2">
              <Label>IMEI</Label>
              <Input
                placeholder="Optional — 15-digit IMEI"
                value={imeiInput}
                onChange={(e) => setImeiInput(e.target.value)}
                maxLength={15}
              />
            </div>

            {/* Partner */}
            <div className="grid gap-2">
              <Label>Partner</Label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="grid gap-2">
              <Label>Display Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as "AUD" | "NZD")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUD">AUD</SelectItem>
                  <SelectItem value="NZD">NZD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error */}
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!selectedDevice || !selectedGrade || submitting}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
