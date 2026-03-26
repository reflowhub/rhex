"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Search,
  Loader2,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SELL_GRADE_LABELS, GRADE_COLORS } from "@/lib/grades";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface GradePrice {
  label: string;
  priceAUD: number;
}

interface TradeInEstimatorProps {
  productPriceAUD: number;
  formatPrice: (priceAUD: number) => string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradeInEstimator({
  productPriceAUD,
  formatPrice,
}: TradeInEstimatorProps) {
  // Panel state
  const [open, setOpen] = useState(false);
  const [fullyOpen, setFullyOpen] = useState(false);
  const [devicesLoaded, setDevicesLoaded] = useState(false);

  // Device search
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Grade + pricing
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [gradePrices, setGradePrices] = useState<Record<string, GradePrice> | null>(null);
  const [fetchingPrices, setFetchingPrices] = useState(false);

  // Track when open animation finishes so we can allow overflow
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setFullyOpen(true), 220);
      return () => clearTimeout(timer);
    } else {
      setFullyOpen(false);
    }
  }, [open]);

  // Lazy-load device list on first expand
  useEffect(() => {
    if (!open || devicesLoaded) return;
    setLoadingDevices(true);
    fetch("/api/devices?category=Phone")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Device[]) => {
        setDevices(data);
        setDevicesLoaded(true);
      })
      .catch(() => {})
      .finally(() => setLoadingDevices(false));
  }, [open, devicesLoaded]);

  // Fuzzy filter (same pattern as sell page)
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return devices
      .filter((d) => {
        const haystack = `${d.make} ${d.model} ${d.storage}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      })
      .slice(0, 8);
  }, [devices, query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlightIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  // Fetch trade-in prices when device is selected
  useEffect(() => {
    if (!selectedDevice) {
      setGradePrices(null);
      setSelectedGrade(null);
      return;
    }

    setFetchingPrices(true);
    setGradePrices(null);
    setSelectedGrade(null);

    fetch(`/api/buy/tradein-estimate?deviceId=${selectedDevice.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.grades) {
          setGradePrices(data.grades);
        }
      })
      .catch(() => {})
      .finally(() => setFetchingPrices(false));
  }, [selectedDevice]);

  // Handlers
  const selectDevice = (device: Device) => {
    setSelectedDevice(device);
    setQuery(`${device.make} ${device.model} ${device.storage}`);
    setDropdownOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedDevice(null);
    setDropdownOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectDevice(filtered[highlightIndex]);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
  };

  // Effective price
  const selectedPrice =
    selectedGrade && gradePrices?.[selectedGrade]
      ? gradePrices[selectedGrade].priceAUD
      : null;
  const effectivePriceAUD =
    selectedPrice != null ? Math.max(0, productPriceAUD - selectedPrice) : null;

  // Grade keys sorted A→E
  const gradeKeys = gradePrices
    ? Object.keys(gradePrices).sort()
    : [];

  return (
    <div className={cn("mt-6 rounded-lg border border-border", !fullyOpen && "overflow-hidden")}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        Offset by trading in an old device
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Collapsible body */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className={fullyOpen ? "overflow-visible" : "overflow-hidden"}>
          <div className="px-4 pb-4 space-y-4">
            {/* Device search */}
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  onFocus={() => query.trim() && setDropdownOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search e.g. iPhone 13 Pro 128GB"
                  className="flex h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  autoComplete="off"
                />
              </div>

              {/* Dropdown */}
              {dropdownOpen && query.trim() && !loadingDevices && (
                <ul
                  ref={listRef}
                  className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
                >
                  {filtered.length === 0 ? (
                    <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No devices found
                    </li>
                  ) : (
                    filtered.map((device, i) => (
                      <li
                        key={device.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectDevice(device);
                        }}
                        onMouseEnter={() => setHighlightIndex(i)}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm",
                          i === highlightIndex &&
                            "bg-accent text-accent-foreground"
                        )}
                      >
                        <span>
                          <span className="font-medium">{device.make}</span>{" "}
                          {device.model}
                        </span>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          {device.storage}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>

            {/* Selected device chip */}
            {selectedDevice && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {selectedDevice.make} {selectedDevice.model}
                </span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {selectedDevice.storage}
                </Badge>
              </div>
            )}

            {/* Grade selection */}
            {selectedDevice && fetchingPrices && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {selectedDevice && gradePrices && gradeKeys.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Select the condition of your device
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {gradeKeys.map((grade) => {
                    const info = gradePrices[grade];
                    const isSelected = selectedGrade === grade;
                    return (
                      <button
                        key={grade}
                        onClick={() => setSelectedGrade(grade)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-foreground/30 hover:bg-muted/50"
                        )}
                      >
                        <span className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-xs font-medium border",
                          GRADE_COLORS[grade] ?? "bg-muted text-foreground border-border"
                        )}>
                          {grade}
                        </span>
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {info.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price reveal */}
            {selectedGrade && selectedPrice != null && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Estimated trade-in value
                  </span>
                  <span className="text-lg font-medium tabular-nums text-primary">
                    {formatPrice(selectedPrice)}
                  </span>
                </div>
                {effectivePriceAUD != null && effectivePriceAUD > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pay as low as{" "}
                    <span className="font-medium text-foreground">
                      {formatPrice(effectivePriceAUD)}
                    </span>{" "}
                    with trade-in
                  </p>
                )}
                {effectivePriceAUD != null && effectivePriceAUD <= 0 && (
                  <p className="mt-1 text-sm font-medium text-primary">
                    Your trade-in covers the full cost!
                  </p>
                )}
                <Link
                  href={`/sell/quote?device=${selectedDevice!.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Get your full trade-in quote
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {/* No pricing available */}
            {selectedDevice && !fetchingPrices && gradePrices === null && (
              <p className="text-xs text-muted-foreground">
                Trade-in pricing not available for this device.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
