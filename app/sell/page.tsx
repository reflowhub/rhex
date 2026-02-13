"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Smartphone,
  ArrowRight,
  Search,
  Loader2,
  ClipboardCheck,
  Package,
  Banknote,
  ShieldCheck,
  Clock,
  Undo2,
  ChevronDown,
  Hash,
  AlertCircle,
  HelpCircle,
  Send,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCurrency } from "@/lib/currency-context";
import { captureReferral } from "@/lib/referral";
import { cn } from "@/lib/utils";

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface CategoryGrade {
  key: string;
  label: string;
}

interface CategoryInfo {
  name: string;
  grades: CategoryGrade[];
}

const FAQ_ITEMS = [
  {
    q: "How does the trade-in process work?",
    a: "Search for your device, answer a few quick questions about its condition to get an instant quote. If you're happy with the price, accept the quote, provide your details, and post your device to us. Once we receive and verify it, we'll send your payment.",
  },
  {
    q: "How is my device graded?",
    a: "We use a simple 5-grade system (A to E) based on your device's condition. Grade A is excellent (like new), Grade B has minor wear, Grade C has functional issues or noticeable wear, Grade D has screen problems, and Grade E is for devices that don't power on. You'll answer a short set of yes/no questions and we'll determine the grade for you.",
  },
  {
    q: "How long is my quote valid?",
    a: "Quotes are valid for 14 days from the date they're generated. After that, you can request a new quote — though prices may have changed.",
  },
  {
    q: "What happens if you grade my device differently?",
    a: "If our inspection finds the device is in a different condition than described, we'll send you a revised offer. You can accept the new price or request your device back free of charge — no risk to you.",
  },
  {
    q: "How do I get paid?",
    a: "We offer payment via PayID (using your mobile number) or direct bank transfer (BSB + account number). Payment is processed once your device passes our inspection.",
  },
  {
    q: "How fast will I receive payment?",
    a: "Once we receive and inspect your device, payment is typically processed within 3\u20135 business days.",
  },
  {
    q: "Do I need to factory reset my phone before sending it?",
    a: "Yes. Please back up your data, sign out of all accounts (iCloud, Google, Samsung, etc.), and perform a factory reset before shipping. This protects your personal information.",
  },
  {
    q: "What devices do you accept?",
    a: "We accept a wide range of smartphones from Apple, Samsung, Google, OPPO, Xiaomi, Huawei, and more. Search for your device above to check if it's in our system.",
  },
];

export default function Home() {
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Phone");
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [searchMode, setSearchMode] = useState<"name" | "imei">("name");
  const [imeiInput, setImeiInput] = useState("");
  const [imeiLoading, setImeiLoading] = useState(false);
  const [imeiError, setImeiError] = useState<string | null>(null);
  const [storageOptions, setStorageOptions] = useState<string[] | null>(null);
  const [imeiDeviceName, setImeiDeviceName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // "Can't find your device?" state
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDevice, setRequestDevice] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Capture referral code from URL (?ref=PARTNERCODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) captureReferral(ref);
  }, []);

  // Fetch categories
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CategoryInfo[]) => {
        setCategories(data);
        if (data.length > 0 && !data.find((c) => c.name === "Phone")) {
          setSelectedCategory(data[0].name);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch devices filtered by category
  useEffect(() => {
    setLoading(true);
    setDevices([]);
    setQuery("");
    setSelectedDevice(null);
    setOpen(false);
    async function fetchDevices() {
      try {
        const res = await fetch(`/api/devices?category=${encodeURIComponent(selectedCategory)}`);
        if (res.ok) {
          const data = await res.json();
          setDevices(data);
        }
      } catch (error) {
        console.error("Failed to fetch devices:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDevices();
  }, [selectedCategory]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = devices.filter((d) => {
      const haystack = `${d.make} ${d.model} ${d.storage}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
    return matches.slice(0, 8);
  }, [devices, query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlightIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const selectDevice = (device: Device) => {
    setSelectedDevice(device);
    setQuery(`${device.make} ${device.model} ${device.storage}`);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
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
      setOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedDevice(null);
    setOpen(true);
  };

  const handleImeiLookup = async () => {
    const cleaned = imeiInput.replace(/[\s\-]/g, "");
    if (cleaned.length !== 15) {
      setImeiError("IMEI must be 15 digits");
      return;
    }
    if (!/^\d{15}$/.test(cleaned)) {
      setImeiError("IMEI must contain only numbers");
      return;
    }

    setImeiLoading(true);
    setImeiError(null);
    setStorageOptions(null);
    setSelectedDevice(null);

    try {
      const res = await fetch("/api/imei", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: cleaned }),
      });
      const data = await res.json();

      if (!data.valid) {
        setImeiError(data.error || "Invalid IMEI number");
        return;
      }

      if (data.deviceId) {
        // Exact match found
        setSelectedDevice({
          id: data.deviceId,
          make: data.make,
          model: data.model,
          storage: data.storage,
        });
        setStorageOptions(null);
        setImeiDeviceName(null);
      } else if (data.needsStorageSelection && data.storageOptions) {
        // Device found but need to pick storage
        setImeiDeviceName(data.deviceName);
        setStorageOptions(data.storageOptions);
      } else if (data.needsManualSelection) {
        setImeiError(
          "We couldn't identify this device. Try searching by name instead."
        );
      }
    } catch {
      setImeiError("Failed to look up IMEI. Please try again.");
    } finally {
      setImeiLoading(false);
    }
  };

  const handleStorageSelect = (storage: string) => {
    // Find the device with this storage from our loaded devices
    const match = devices.find(
      (d) =>
        imeiDeviceName &&
        `${d.make} ${d.model}`.toLowerCase() ===
          imeiDeviceName.toLowerCase() &&
        d.storage === storage
    );
    if (match) {
      setSelectedDevice(match);
      setStorageOptions(null);
      setImeiDeviceName(null);
    }
  };

  const handleGetQuote = () => {
    if (selectedDevice) {
      const params = new URLSearchParams({ device: selectedDevice.id });
      if (searchMode === "imei" && imeiInput.trim()) {
        params.set("imei", imeiInput.replace(/[\s\-]/g, ""));
      }
      router.push(`/sell/quote?${params.toString()}`);
    }
  };

  const handleDeviceRequest = async () => {
    if (!requestDevice.trim()) return;
    setRequestSubmitting(true);
    try {
      await fetch("/api/device-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device: requestDevice.trim(),
          email: requestEmail.trim() || null,
        }),
      });
      setRequestSubmitted(true);
    } catch {
      // Still show success — request is best-effort
      setRequestSubmitted(true);
    } finally {
      setRequestSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/sell" className="flex items-center gap-2.5">
            <Image
              src="/logo-rhex.svg"
              alt="rhex"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span className="text-xl font-bold tracking-tight whitespace-nowrap">
              rhex trade-in
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/buy"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Shop
            </Link>
            <Link
              href="/sell/business"
              className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Business
            </Link>
            <Link
              href="/partner/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Partners
            </Link>
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background illustration */}
        <div
          className="pointer-events-none absolute inset-0 bg-no-repeat bg-cover bg-center"
          style={{ backgroundImage: "url(/hero-bg.svg)" }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-5xl px-4 py-16 md:py-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Trade in your device{" "}
            <span className="text-primary">for cash</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Get an instant quote in seconds. No sign-up required.
          </p>
        </div>

        {/* Search Card */}
        <div className="mx-auto mt-12 max-w-lg">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            {/* Category Tabs */}
            {categories.length > 1 && (
              <div className="mb-4 flex rounded-lg border bg-background p-1">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={cn(
                      "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      selectedCategory === cat.name
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Mode Tabs */}
            <div className="mb-4 flex rounded-lg border bg-background p-1">
              <button
                onClick={() => {
                  setSearchMode("name");
                  setSelectedDevice(null);
                  setImeiError(null);
                  setStorageOptions(null);
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  searchMode === "name"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Search className="mr-1.5 inline-block h-3.5 w-3.5" />
                Search by name
              </button>
              <button
                onClick={() => {
                  setSearchMode("imei");
                  setSelectedDevice(null);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  searchMode === "imei"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Hash className="mr-1.5 inline-block h-3.5 w-3.5" />
                Search by IMEI
              </button>
            </div>

            <div className="space-y-4">
              {/* Name Search Mode */}
              {searchMode === "name" && (
                <div className="relative">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={handleInputChange}
                      onFocus={() => query.trim() && setOpen(true)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        loading
                          ? "Loading devices..."
                          : "Search e.g. iPhone 15 128GB"
                      }
                      disabled={loading}
                      className="flex h-12 w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      autoComplete="off"
                    />
                    {loading && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Dropdown */}
                  {open && query.trim() && !loading && (
                    <ul
                      ref={listRef}
                      className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
                    >
                      {filtered.length === 0 ? (
                        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
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
                              "flex cursor-pointer items-center justify-between rounded-sm px-3 py-2.5 text-sm",
                              i === highlightIndex &&
                                "bg-accent text-accent-foreground"
                            )}
                          >
                            <span>
                              <span className="font-medium">
                                {device.make}
                              </span>{" "}
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
              )}

              {/* IMEI Search Mode */}
              {searchMode === "imei" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={imeiInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^\d\s\-]/g, "");
                        setImeiInput(val);
                        setImeiError(null);
                        setSelectedDevice(null);
                        setStorageOptions(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleImeiLookup();
                        }
                      }}
                      placeholder="Enter 15-digit IMEI"
                      maxLength={17}
                      className="flex h-12 w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      autoComplete="off"
                    />
                    {imeiLoading && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dial <span className="font-mono font-medium">*#06#</span>{" "}
                    on your phone to find your IMEI
                  </p>

                  {/* IMEI Error */}
                  {imeiError && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {imeiError}
                    </div>
                  )}

                  {/* Storage Selection */}
                  {storageOptions && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {imeiDeviceName} — Select storage:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {storageOptions.map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStorageSelect(s)}
                            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lookup Button */}
                  {!selectedDevice && !storageOptions && (
                    <Button
                      onClick={handleImeiLookup}
                      disabled={
                        imeiLoading ||
                        imeiInput.replace(/[\s\-]/g, "").length < 15
                      }
                      variant="secondary"
                      className="w-full"
                    >
                      {imeiLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Looking up...
                        </>
                      ) : (
                        "Look up device"
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Selected device chip */}
              {selectedDevice && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {selectedDevice.make} {selectedDevice.model}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {selectedDevice.storage}
                  </Badge>
                </div>
              )}

              {/* CTA */}
              <Button
                onClick={handleGetQuote}
                disabled={!selectedDevice}
                className="w-full"
                size="lg"
              >
                Get Quote
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Can't find your device? */}
          <div className="mt-4 text-center">
            {!requestOpen && !requestSubmitted && (
              <button
                onClick={() => setRequestOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Can&apos;t find your device?
              </button>
            )}
            {requestOpen && !requestSubmitted && (
              <div className="mx-auto max-w-lg rounded-xl border bg-card p-4 text-left">
                <p className="text-sm font-medium">
                  Tell us which device you&apos;d like to trade in
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  We&apos;ll review your request and may add it to our supported devices.
                </p>
                <div className="mt-3 space-y-2.5">
                  <Input
                    placeholder="e.g. Samsung Galaxy S24 Ultra 512GB"
                    value={requestDevice}
                    onChange={(e) => setRequestDevice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleDeviceRequest();
                    }}
                  />
                  <Input
                    type="email"
                    placeholder="Email (optional — we'll notify you when added)"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleDeviceRequest();
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleDeviceRequest}
                      disabled={!requestDevice.trim() || requestSubmitting}
                      size="sm"
                    >
                      {requestSubmitting ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-3.5 w-3.5" />
                      )}
                      Submit Request
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRequestOpen(false);
                        setRequestDevice("");
                        setRequestEmail("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {requestSubmitted && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Thanks! We&apos;ll review your request.
              </div>
            )}
          </div>
        </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="border-t bg-card py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Risk-free",
              desc: "Don't like our revised offer? We'll return your device free of charge.",
            },
            {
              icon: Clock,
              title: "Fast payment",
              desc: "Payment processed within 3\u20135 business days of inspection.",
            },
            {
              icon: Undo2,
              title: "14-day quotes",
              desc: "Your quote is locked in for 14 days. No pressure.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 rounded-lg p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Social Proof / Awards */}
      <section className="border-t py-10">
        <div className="mx-auto max-w-5xl px-4">
          <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Recognised by
          </p>
          <div className="grid grid-cols-2 items-center justify-items-center gap-8 sm:flex sm:justify-center sm:gap-14">
            {[
              { src: "/marketing/deloitte-tech-fast-50.png", alt: "Deloitte Technology Fast 50 2020" },
              { src: "/marketing/ft-high-growth.png", alt: "Financial Times High Growth 2022" },
              { src: "/marketing/afr-fast-100.png", alt: "AFR Fast 100" },
              { src: "/marketing/deloitte-fast-500-apac.png", alt: "Deloitte Fast 500 APAC Winner" },
            ].map((logo) => (
              <Image
                key={logo.src}
                src={logo.src}
                alt={logo.alt}
                width={160}
                height={48}
                className="h-10 w-auto shrink-0 object-contain opacity-70 grayscale transition-all hover:opacity-100 hover:grayscale-0 sm:h-12"
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold">
            How it works
          </h2>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "1",
                icon: Search,
                title: "Find your device",
                desc: "Search by brand, model, or storage to find your phone.",
              },
              {
                step: "2",
                icon: ClipboardCheck,
                title: "Answer a few questions",
                desc: "Quick yes/no questions about your device's condition to determine the grade.",
              },
              {
                step: "3",
                icon: Package,
                title: "Ship it to us",
                desc: "Accept your quote, then post your device to us with the shipping details provided.",
              },
              {
                step: "4",
                icon: Banknote,
                title: "Get paid",
                desc: "We inspect your device and send payment via PayID or bank transfer.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <item.icon className="h-6 w-6" />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-xs font-bold text-foreground shadow-sm ring-2 ring-background">
                    {item.step}
                  </span>
                </div>
                <h3 className="mb-1 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t bg-card py-16">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold">
            Frequently asked questions
          </h2>
          <div className="divide-y rounded-xl border bg-background">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  {item.q}
                  <ChevronDown
                    className={cn(
                      "ml-4 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      openFaq === i && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-200 ease-in-out",
                    openFaq === i
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business CTA */}
      <section className="border-t py-12">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-xl font-bold">Have multiple devices to trade in?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload a manifest and get an instant bulk estimate for your business.
          </p>
          <Link href="/sell/business">
            <Button variant="outline" className="mt-4">
              Business Estimator
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Image
                src="/logo-rhex.svg"
                alt="rhex"
                width={16}
                height={16}
                className="h-4 w-4 opacity-50"
              />
              <p>Reflow Hub Pty Ltd</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms & Conditions
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/61426908433"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </main>
  );
}
