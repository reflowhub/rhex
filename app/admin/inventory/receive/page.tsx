"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Search, CheckCircle2 } from "lucide-react";
import { useFX } from "@/lib/use-fx";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Quote {
  id: string;
  deviceMake: string;
  deviceModel: string;
  deviceStorage: string;
  deviceId: string;
  grade: string;
  quotePriceNZD: number;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  imei: string | null;
  inspectionGrade: string | null;
  revisedPriceNZD: number | null;
}

interface BulkQuote {
  id: string;
  businessName: string | null;
  contactName: string | null;
  totalDevices: number;
  totalIndicativeNZD: number;
  status: string;
}

interface BulkLine {
  id: string;
  rawInput: string;
  deviceId: string | null;
  deviceName: string | null;
  quantity: number;
  assumedGrade: string;
  indicativePriceNZD: number;
  actualGrade: string | null;
  actualPriceNZD: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECEIVABLE_STATUSES = ["received", "inspected", "paid"];
const GRADES = ["A", "B", "C", "D", "E"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReceiveInventoryPage() {
  const router = useRouter();
  const { formatPrice: fxFormatPrice } = useFX();

  // ---- quote type toggle --------------------------------------------------
  const [quoteType, setQuoteType] = useState<"individual" | "bulk">(
    "individual"
  );

  // ---- search state -------------------------------------------------------
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // ---- individual quotes state --------------------------------------------
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // ---- bulk quotes state --------------------------------------------------
  const [bulkQuotes, setBulkQuotes] = useState<BulkQuote[]>([]);
  const [selectedBulk, setSelectedBulk] = useState<BulkQuote | null>(null);
  const [bulkLines, setBulkLines] = useState<BulkLine[]>([]);
  const [bulkLinesLoading, setBulkLinesLoading] = useState(false);
  const [selectedLine, setSelectedLine] = useState<BulkLine | null>(null);

  // ---- intake form state --------------------------------------------------
  const [serial, setSerial] = useState("");
  const [cosmeticGrade, setCosmeticGrade] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [sellPriceAUD, setSellPriceAUD] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- debounce search ----------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ---- reset selection when type changes ----------------------------------
  useEffect(() => {
    setSelectedQuote(null);
    setSelectedBulk(null);
    setBulkLines([]);
    setSelectedLine(null);
    resetForm();
    setQuotes([]);
    setBulkQuotes([]);
    setSearchInput("");
    setDebouncedSearch("");
  }, [quoteType]);

  // ---- search quotes/bulk quotes ------------------------------------------
  useEffect(() => {
    if (!debouncedSearch) {
      setQuotes([]);
      setBulkQuotes([]);
      return;
    }

    setSearchLoading(true);

    if (quoteType === "individual") {
      fetch(`/api/admin/quotes?search=${encodeURIComponent(debouncedSearch)}`)
        .then((res) => res.json())
        .then((data: Quote[]) => {
          if (Array.isArray(data)) {
            setQuotes(
              data.filter((q) => RECEIVABLE_STATUSES.includes(q.status))
            );
          }
        })
        .finally(() => setSearchLoading(false));
    } else {
      fetch(
        `/api/admin/bulk-quotes?search=${encodeURIComponent(debouncedSearch)}`
      )
        .then((res) => res.json())
        .then((data: BulkQuote[]) => {
          if (Array.isArray(data)) {
            setBulkQuotes(
              data.filter((q) => RECEIVABLE_STATUSES.includes(q.status))
            );
          }
        })
        .finally(() => setSearchLoading(false));
    }
  }, [debouncedSearch, quoteType]);

  // ---- fetch bulk quote lines when a bulk quote is selected ---------------
  useEffect(() => {
    if (!selectedBulk) {
      setBulkLines([]);
      setSelectedLine(null);
      return;
    }

    setBulkLinesLoading(true);
    fetch(`/api/admin/bulk-quotes/${selectedBulk.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.devices && Array.isArray(data.devices)) {
          setBulkLines(data.devices);
        }
      })
      .finally(() => setBulkLinesLoading(false));
  }, [selectedBulk]);

  // ---- pre-fill form when quote/line is selected --------------------------
  const prefillFromQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setSerial(quote.imei ?? "");
    setCosmeticGrade(quote.inspectionGrade ?? quote.grade ?? "");
    resetFormValues();
  };

  const prefillFromLine = (line: BulkLine) => {
    setSelectedLine(line);
    setSerial("");
    setCosmeticGrade(line.actualGrade ?? line.assumedGrade ?? "");
    resetFormValues();
  };

  const resetFormValues = () => {
    setSellPriceAUD("");
    setBatteryHealth("");
    setLocation("");
    setNotes("");
    setFormError(null);
  };

  const resetForm = () => {
    setSerial("");
    setCosmeticGrade("");
    resetFormValues();
  };

  // ---- submit -------------------------------------------------------------
  const handleSubmit = async () => {
    if (!serial || !cosmeticGrade || !sellPriceAUD) return;

    setSubmitting(true);
    setFormError(null);

    const body: Record<string, unknown> = {
      quoteType,
      serial,
      cosmeticGrade,
      sellPriceAUD: parseFloat(sellPriceAUD),
    };

    if (batteryHealth) {
      body.batteryHealth = parseInt(batteryHealth, 10);
    }
    if (location) {
      body.location = location;
    }
    if (notes) {
      body.notes = notes;
    }

    if (quoteType === "individual" && selectedQuote) {
      body.quoteId = selectedQuote.id;
    } else if (quoteType === "bulk" && selectedBulk && selectedLine) {
      body.quoteId = selectedBulk.id;
      body.lineId = selectedLine.id;
    }

    try {
      const res = await fetch("/api/admin/inventory/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/inventory/${data.id}`);
      } else {
        const data = await res.json();
        setFormError(data.error || "Failed to receive into inventory");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- helpers ------------------------------------------------------------
  const formatPrice = (amount: number | null | undefined) => {
    return fxFormatPrice(amount, "AUD");
  };

  const isFormReady =
    (quoteType === "individual" && selectedQuote) ||
    (quoteType === "bulk" && selectedBulk && selectedLine);

  const isFormValid =
    isFormReady && serial.trim() !== "" && cosmeticGrade !== "" && sellPriceAUD !== "";

  // ---- render -------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/inventory")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Inventory
      </Button>

      <h1 className="text-3xl font-bold tracking-tight">
        Receive Device into Inventory
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Find a quote and create an inventory record for the received device.
      </p>

      {/* ================================================================== */}
      {/* Section 1: Find Quote                                               */}
      {/* ================================================================== */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">1. Find Quote</h2>

        {/* Quote type toggle */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setQuoteType("individual")}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              quoteType === "individual"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            Individual Quote
          </button>
          <button
            onClick={() => setQuoteType("bulk")}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              quoteType === "bulk"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            Bulk Quote
          </button>
        </div>

        {/* Search */}
        <div className="mt-4 flex max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                quoteType === "individual"
                  ? "Search by customer name or email..."
                  : "Search by business name or email..."
              }
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Search results */}
        {debouncedSearch && (
          <div className="mt-4 rounded-lg border border-border bg-card">
            {searchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Searching...
                </span>
              </div>
            ) : quoteType === "individual" ? (
              quotes.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No receivable quotes found.
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
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((q) => (
                      <TableRow
                        key={q.id}
                        className={cn(
                          "cursor-pointer",
                          selectedQuote?.id === q.id && "bg-primary/5"
                        )}
                        onClick={() => prefillFromQuote(q)}
                      >
                        <TableCell className="font-mono text-xs uppercase">
                          {q.id.substring(0, 8)}
                        </TableCell>
                        <TableCell>
                          {[q.deviceMake, q.deviceModel, q.deviceStorage]
                            .filter(Boolean)
                            .join(" ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{q.grade}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPrice(q.quotePriceNZD)}
                        </TableCell>
                        <TableCell>{q.customerName || "\u2014"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{q.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : bulkQuotes.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No receivable bulk quotes found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote ID</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead className="text-right">Devices</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkQuotes.map((bq) => (
                    <TableRow
                      key={bq.id}
                      className={cn(
                        "cursor-pointer",
                        selectedBulk?.id === bq.id && "bg-primary/5"
                      )}
                      onClick={() => {
                        setSelectedBulk(bq);
                        setSelectedLine(null);
                        resetForm();
                      }}
                    >
                      <TableCell className="font-mono text-xs uppercase">
                        {bq.id.substring(0, 8)}
                      </TableCell>
                      <TableCell>
                        {bq.businessName || bq.contactName || "\u2014"}
                      </TableCell>
                      <TableCell className="text-right">
                        {bq.totalDevices}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(bq.totalIndicativeNZD)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{bq.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Section 2: Quote Summary / Line Selection (bulk)                    */}
      {/* ================================================================== */}
      {quoteType === "individual" && selectedQuote && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">2. Selected Quote</h2>
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">
                {selectedQuote.deviceMake} {selectedQuote.deviceModel}{" "}
                {selectedQuote.deviceStorage}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Grade</dt>
                <dd className="font-medium">
                  {selectedQuote.inspectionGrade ?? selectedQuote.grade}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Price</dt>
                <dd className="font-medium">
                  {formatPrice(
                    selectedQuote.revisedPriceNZD ?? selectedQuote.quotePriceNZD
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="font-medium">
                  {selectedQuote.customerName || "\u2014"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">IMEI</dt>
                <dd className="font-mono text-xs">
                  {selectedQuote.imei || "\u2014"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {quoteType === "bulk" && selectedBulk && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">
            2. Select Device Line
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select which device line to receive into inventory.
          </p>

          <div className="mt-3 rounded-lg border border-border bg-card">
            {bulkLinesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading device lines...
                </span>
              </div>
            ) : bulkLines.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No device lines found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkLines.map((line) => (
                    <TableRow
                      key={line.id}
                      className={cn(
                        selectedLine?.id === line.id && "bg-primary/5"
                      )}
                    >
                      <TableCell>
                        {line.deviceName || line.rawInput}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.quantity}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {line.actualGrade ?? line.assumedGrade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(
                          line.actualPriceNZD ?? line.indicativePriceNZD
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={
                            selectedLine?.id === line.id
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => prefillFromLine(line)}
                        >
                          {selectedLine?.id === line.id
                            ? "Selected"
                            : "Select"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Section 3: Intake Form                                              */}
      {/* ================================================================== */}
      {isFormReady && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">
            {quoteType === "bulk" ? "3" : "3"}. Intake Details
          </h2>

          <div className="mt-3 rounded-lg border border-border bg-card p-6">
            {formError && (
              <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Serial / IMEI */}
              <div className="grid gap-2">
                <Label htmlFor="serial">Serial / IMEI *</Label>
                <Input
                  id="serial"
                  placeholder="Enter IMEI or serial number"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                />
              </div>

              {/* Cosmetic Grade */}
              <div className="grid gap-2">
                <Label htmlFor="grade">Cosmetic Grade *</Label>
                <Select value={cosmeticGrade} onValueChange={setCosmeticGrade}>
                  <SelectTrigger id="grade">
                    <SelectValue placeholder="Select grade..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>
                        Grade {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Battery Health */}
              <div className="grid gap-2">
                <Label htmlFor="battery">Battery Health (%)</Label>
                <Input
                  id="battery"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 87"
                  value={batteryHealth}
                  onChange={(e) => setBatteryHealth(e.target.value)}
                />
              </div>

              {/* Sell Price AUD */}
              <div className="grid gap-2">
                <Label htmlFor="sell-price">Sell Price (AUD) *</Label>
                <Input
                  id="sell-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter sell price"
                  value={sellPriceAUD}
                  onChange={(e) => setSellPriceAUD(e.target.value)}
                />
              </div>

              {/* Location */}
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Shelf A3"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4 grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Any notes about the device condition..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Submit */}
            <div className="mt-6">
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid || submitting}
                className="w-full sm:w-auto"
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Receive into Inventory
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
