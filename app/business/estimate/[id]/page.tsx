"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Download,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  Calculator,
  AlertCircle,
  Link2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviceLine {
  id: string;
  rawInput: string;
  deviceId: string | null;
  deviceName: string | null;
  matchConfidence: "high" | "medium" | "low" | "manual";
  quantity: number;
  assumedGrade: string;
  indicativePriceNZD: number;
  actualGrade: string | null;
  actualPriceNZD: number | null;
  inspectionNotes: string | null;
}

interface BulkQuote {
  id: string;
  businessName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  type: string;
  category: string | null;
  assumedGrade: string;
  totalDevices: number;
  totalIndicativeNZD: number;
  matchedCount: number;
  unmatchedCount: number;
  status: string;
  paymentMethod: string | null;
  createdAt: string | null;
  acceptedAt: string | null;
  devices: DeviceLine[];
}

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

const CONFIDENCE_BADGE: Record<
  string,
  { variant: "default" | "secondary" | "outline" | "destructive"; className?: string; label: string }
> = {
  high: {
    variant: "default",
    className: "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80",
    label: "Matched",
  },
  medium: {
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    label: "Likely",
  },
  low: {
    variant: "destructive",
    label: "Unmatched",
  },
  manual: {
    variant: "default",
    className: "border-transparent bg-blue-600 text-white hover:bg-blue-600/80",
    label: "Manual",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EstimateResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currency, fxRate, convertFromNZD, setCurrency } = useCurrency();

  // Data state
  const [quote, setQuote] = useState<BulkQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Accept form state
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [payIdPhone, setPayIdPhone] = useState("");
  const [bankBSB, setBankBSB] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  // Resolve dialog
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveLineId, setResolveLineId] = useState<string | null>(null);
  const [resolveRawInput, setResolveRawInput] = useState("");
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [deviceQuery, setDeviceQuery] = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  // Fetch quote data
  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch(`/api/business/estimate/${id}`);
        if (res.ok) {
          const data = await res.json();
          setQuote(data);
          if (data.businessName) setBusinessName(data.businessName);
          if (data.contactEmail) setContactEmail(data.contactEmail);
        } else {
          const errData = await res.json();
          setError(errData.error || "Failed to load estimate");
        }
      } catch (err) {
        console.error("Failed to fetch estimate:", err);
        setError("Failed to load estimate");
      } finally {
        setLoading(false);
      }
    }
    fetchQuote();
  }, [id]);

  // Fetch devices for resolve dialog (filtered by estimate category)
  useEffect(() => {
    if (!quote) return;
    const cat = quote.category || "Phone";
    async function fetchDevices() {
      try {
        const res = await fetch(`/api/devices?category=${encodeURIComponent(cat)}`);
        if (res.ok) {
          const data = await res.json();
          setAllDevices(data);
        }
      } catch (err) {
        console.error("Failed to fetch devices:", err);
      }
    }
    fetchDevices();
  }, [quote]);

  // Filtered devices for resolve dialog
  const filteredDevices = useMemo(() => {
    if (!deviceQuery.trim()) return [];
    const words = deviceQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return allDevices
      .filter((d) => {
        const haystack = `${d.make} ${d.model} ${d.storage}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      })
      .slice(0, 8);
  }, [allDevices, deviceQuery]);

  // Pagination
  const devices = quote?.devices || [];
  const totalPages = Math.max(1, Math.ceil(devices.length / PAGE_SIZE));
  const paginatedDevices = devices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Format price with currency
  const formatPrice = (nzd: number) => {
    const converted = convertFromNZD(nzd);
    return `$${converted.toLocaleString("en-NZ", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Export CSV
  const handleExport = () => {
    window.open(`/api/business/estimate/${id}/export`, "_blank");
  };

  // Accept estimate
  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcceptSubmitting(true);
    setError(null);

    const body: Record<string, string> = {
      businessName,
      contactName,
      contactEmail,
      contactPhone,
      paymentMethod,
    };

    if (paymentMethod === "payid") {
      body.payIdPhone = payIdPhone;
    } else {
      body.bankBSB = bankBSB;
      body.bankAccountNumber = bankAccountNumber;
      body.bankAccountName = bankAccountName;
    }

    try {
      const res = await fetch(`/api/business/estimate/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setQuote((prev) =>
          prev ? { ...prev, status: data.status, acceptedAt: data.acceptedAt } : prev
        );
        setShowAcceptForm(false);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to accept estimate");
      }
    } catch {
      setError("Failed to accept estimate. Please try again.");
    } finally {
      setAcceptSubmitting(false);
    }
  };

  // Resolve unmatched device
  const openResolve = (lineId: string, rawInput: string) => {
    setResolveLineId(lineId);
    setResolveRawInput(rawInput);
    setDeviceQuery("");
    setResolveOpen(true);
  };

  const handleResolve = async (device: Device) => {
    if (!resolveLineId) return;
    setResolveSubmitting(true);

    try {
      // Save alias for future matching
      await fetch("/api/admin/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: resolveRawInput,
          deviceId: device.id,
        }),
      });

      // Refresh the estimate to show updated data
      const res = await fetch(`/api/business/estimate/${id}`);
      if (res.ok) {
        const data = await res.json();
        setQuote(data);
      }

      setResolveOpen(false);
    } catch {
      setError("Failed to resolve device");
    } finally {
      setResolveSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/business")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your estimate...</p>
        </div>
      </main>
    );
  }

  // Error / not found
  if (!quote) {
    return (
      <main className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/business")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-destructive">
            Estimate not found
          </h1>
          <p className="mt-2 text-muted-foreground">
            {error || "The estimate you are looking for does not exist."}
          </p>
          <Button className="mt-6" onClick={() => router.push("/business/estimate")}>
            Create New Estimate
          </Button>
        </div>
      </main>
    );
  }

  const isAccepted = quote.status !== "estimated";

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo-rhex.svg"
                alt="rhex"
                width={28}
                height={28}
                className="h-7 w-7"
              />
              <span className="text-xl font-bold tracking-tight">Trade-In</span>
            </Link>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Business
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-lg border bg-background p-0.5 text-xs font-medium">
              <button
                onClick={() => setCurrency("AUD")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  currency === "AUD"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                AUD
              </button>
              <button
                onClick={() => setCurrency("NZD")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  currency === "NZD"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                NZD
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push("/business")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Accepted banner */}
        {isAccepted && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-800">
                  Estimate Accepted
                </p>
                <p className="text-sm text-green-700">
                  Ship your devices to us. We&apos;ll inspect each one and send final
                  payment.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Estimate Summary</h1>
            <Badge
              variant={isAccepted ? "default" : "secondary"}
              className={
                isAccepted
                  ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/80"
                  : ""
              }
            >
              {quote.status}
            </Badge>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Devices</p>
              <p className="mt-1 text-2xl font-bold">{quote.totalDevices}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assumed Grade</p>
              <p className="mt-1 text-2xl font-bold">{quote.assumedGrade}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Total Value ({currency})
              </p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {formatPrice(quote.totalIndicativeNZD)}
              </p>
              {currency === "AUD" && fxRate && (
                <p className="text-xs text-muted-foreground">
                  NZD ${quote.totalIndicativeNZD.toLocaleString("en-NZ", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Match Rate</p>
              <p className="mt-1 text-2xl font-bold">
                {quote.matchedCount} / {quote.matchedCount + quote.unmatchedCount}
              </p>
              {quote.unmatchedCount > 0 && (
                <p className="text-xs text-amber-600">
                  {quote.unmatchedCount} unmatched
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {!isAccepted && (
            <Button onClick={() => setShowAcceptForm(true)}>
              <Check className="mr-2 h-4 w-4" />
              Accept Estimate
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/business/estimate">New Estimate</Link>
          </Button>
        </div>

        {/* Accept Form */}
        {showAcceptForm && !isAccepted && (
          <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">
              Accept Estimate — Your Details
            </h2>
            <form onSubmit={handleAccept} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="biz-name">Business Name</Label>
                <Input
                  id="biz-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Acme Corp"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contact-name">Contact Name</Label>
                <Input
                  id="contact-name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="John Smith"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="john@acme.com"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="04XX XXX XXX"
                  required
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payid">PayID</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === "payid" && (
                <div className="sm:col-span-2">
                  <Label htmlFor="payid-phone">PayID Mobile Number</Label>
                  <Input
                    id="payid-phone"
                    type="tel"
                    value={payIdPhone}
                    onChange={(e) => setPayIdPhone(e.target.value)}
                    placeholder="04XX XXX XXX"
                    required
                    className="mt-1"
                  />
                </div>
              )}

              {paymentMethod === "bank_transfer" && (
                <>
                  <div>
                    <Label htmlFor="bsb">BSB</Label>
                    <Input
                      id="bsb"
                      value={bankBSB}
                      onChange={(e) => setBankBSB(e.target.value)}
                      placeholder="XXX-XXX"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="acc-num">Account Number</Label>
                    <Input
                      id="acc-num"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="XXXXXXXX"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="acc-name">Account Name</Label>
                    <Input
                      id="acc-name"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="Acme Corp Pty Ltd"
                      required
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAcceptForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={acceptSubmitting || !paymentMethod}
                >
                  {acceptSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {acceptSubmitting ? "Submitting..." : "Confirm & Accept"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Device Breakdown */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold">
            Device Breakdown ({devices.length} lines)
          </h2>
          <div className="mt-3 rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Raw Input</TableHead>
                  <TableHead>Matched Device</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">
                    Unit Price ({currency})
                  </TableHead>
                  <TableHead className="text-right">
                    Total ({currency})
                  </TableHead>
                  {!isAccepted && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDevices.map((line, idx) => {
                  const badge = CONFIDENCE_BADGE[line.matchConfidence] || CONFIDENCE_BADGE.low;
                  const unitPriceNZD =
                    line.quantity > 0
                      ? line.indicativePriceNZD / line.quantity
                      : 0;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {line.rawInput}
                      </TableCell>
                      <TableCell className="text-sm">
                        {line.deviceName || (
                          <span className="text-muted-foreground italic">
                            Unmatched
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={badge.variant}
                          className={badge.className}
                        >
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">
                        {unitPriceNZD > 0
                          ? formatPrice(unitPriceNZD)
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {line.indicativePriceNZD > 0
                          ? formatPrice(line.indicativePriceNZD)
                          : "\u2014"}
                      </TableCell>
                      {!isAccepted && (
                        <TableCell>
                          {(line.matchConfidence === "low" ||
                            !line.deviceId) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                openResolve(line.id, line.rawInput)
                              }
                            >
                              <Link2 className="mr-1 h-3 w-3" />
                              Resolve
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {devices.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
                {Math.min(currentPage * PAGE_SIZE, devices.length)} of{" "}
                {devices.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Device</DialogTitle>
            <DialogDescription>
              Manually match &quot;{resolveRawInput}&quot; to a device in our
              library. This saves the mapping for future imports.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={deviceQuery}
                onChange={(e) => setDeviceQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {filteredDevices.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border">
                {filteredDevices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => handleResolve(device)}
                    disabled={resolveSubmitting}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <span>
                      <span className="font-medium">{device.make}</span>{" "}
                      {device.model}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {device.storage}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {deviceQuery.trim() && filteredDevices.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No devices found
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
