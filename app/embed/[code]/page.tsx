"use client";

import { useState, useEffect, useMemo, useRef, useCallback, use } from "react";
import {
  Smartphone,
  ArrowRight,
  ArrowLeft,
  Search,
  Loader2,
  Hash,
  AlertCircle,
  Power,
  MonitorSmartphone,
  Smartphone as SmartphoneIcon,
  Settings,
  Eye,
  Sparkles,
  ChevronRight,
  Check,
  Clock,
  Package,
  CreditCard,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatTimeLeft } from "@/lib/quote-validity";
import { SELL_GRADE_LABELS as GRADE_LABELS } from "@/lib/grades";
import { hexToHSL } from "@/lib/color-utils";
import { TradeInShippingInstructions } from "@/components/trade-in-shipping";
import AuAddressFields from "@/components/au-address-fields";
import {
  EMPTY_AU_ADDRESS,
  isAuAddressComplete,
  type AuAddressInput,
} from "@/lib/au-address";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "search" | "grade" | "quote" | "confirmed";

interface PartnerConfig {
  valid: boolean;
  partnerName: string;
  partnerId: string;
  widgetPrimaryColor: string | null;
  widgetLogoUrl: string | null;
  widgetCustomHeading: string | null;
}

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
}

interface CategoryInfo {
  name: string;
  grades: { key: string; label: string }[];
}

interface GradingStep {
  id: number;
  question: string;
  description: string;
  icon: React.ReactNode;
  yesGrade?: string;
  noGrade?: string;
  yesNext?: number;
  noNext?: number;
}

interface QuoteData {
  id: string;
  deviceId: string;
  grade: string;
  quotePriceNZD: number;
  quotePriceDisplay?: number;
  displayCurrency: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  imei?: string;
  device?: {
    id: string;
    make: string;
    model: string;
    storage: string;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADING_STEPS: GradingStep[] = [
  {
    id: 1,
    question: "Does the phone turn on and reach the home screen?",
    description:
      "Try powering on the device. Does it boot up and show the home screen?",
    icon: <Power className="h-6 w-6" />,
    noGrade: "E",
    yesNext: 2,
  },
  {
    id: 2,
    question: "Is the screen cracked, chipped, shattered, or showing major display damage?",
    description:
      "Examples: cracks, broken glass, dead areas, coloured lines, severe screen defects.",
    icon: <MonitorSmartphone className="h-6 w-6" />,
    yesGrade: "D",
    noNext: 3,
  },
  {
    id: 3,
    question: "Is the housing significantly damaged?",
    description:
      "Examples: bent frame, major dents, broken back glass, missing parts, severe corner damage.",
    icon: <SmartphoneIcon className="h-6 w-6" />,
    yesGrade: "D",
    noNext: 4,
  },
  {
    id: 4,
    question: "Does the phone have any functional issues?",
    description:
      "Examples: faulty buttons, charging problems, speaker or microphone faults, camera issues, poor battery performance.",
    icon: <Settings className="h-6 w-6" />,
    yesGrade: "C",
    noNext: 5,
  },
  {
    id: 5,
    question: "Does the phone have noticeable cosmetic wear?",
    description:
      "Examples: deep scratches, noticeable dents, heavy scuffing, worn edges or substantial surface marks.",
    icon: <Eye className="h-6 w-6" />,
    yesGrade: "C",
    noNext: 6,
  },
  {
    id: 6,
    question: "Does the phone have minor cosmetic wear?",
    description:
      "Examples: light scratches, small scuffs or minor marks from normal use.",
    icon: <Sparkles className="h-6 w-6" />,
    yesGrade: "B",
    noGrade: "A",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EmbedWidgetPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  // Partner config
  const [config, setConfig] = useState<PartnerConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Step management
  const [step, setStep] = useState<Step>("search");

  // Search state
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Phone");
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<"name" | "imei">("name");
  const [imeiInput, setImeiInput] = useState("");
  const [imeiLoading, setImeiLoading] = useState(false);
  const [imeiError, setImeiError] = useState<string | null>(null);
  const [storageOptions, setStorageOptions] = useState<string[] | null>(null);
  const [imeiDeviceName, setImeiDeviceName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Grade state
  const [currentGradeStep, setCurrentGradeStep] = useState(1);
  const [determinedGrade, setDeterminedGrade] = useState<string | null>(null);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [gradeImeiInput, setGradeImeiInput] = useState("");

  // Quote state
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accept form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [payIdPhone, setPayIdPhone] = useState("");
  const [bankBSB, setBankBSB] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [shippingAddress, setShippingAddress] = useState<AuAddressInput>(EMPTY_AU_ADDRESS);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // ---- Fetch partner config on mount
  useEffect(() => {
    fetch(`/api/embed/${code}`)
      .then((res) => res.json())
      .then((data: PartnerConfig) => {
        setConfig(data);
        setConfigLoading(false);
      })
      .catch(() => setConfigLoading(false));
  }, [code]);

  // ---- Fetch categories
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

  // ---- Fetch devices by category
  useEffect(() => {
    setDevicesLoading(true);
    setDevices([]);
    setQuery("");
    setSelectedDevice(null);
    setOpen(false);
    fetch(`/api/devices?category=${encodeURIComponent(selectedCategory)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Device[]) => setDevices(data))
      .catch(() => {})
      .finally(() => setDevicesLoading(false));
  }, [selectedCategory]);

  // ---- Search filtering
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

  // ---- Device selection
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

  // ---- IMEI lookup
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
        setSelectedDevice({
          id: data.deviceId,
          make: data.make,
          model: data.model,
          storage: data.storage,
        });
        setStorageOptions(null);
        setImeiDeviceName(null);
      } else if (data.needsStorageSelection && data.storageOptions) {
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
    const match = devices.find(
      (d) =>
        imeiDeviceName &&
        `${d.make} ${d.model}`.toLowerCase() === imeiDeviceName.toLowerCase() &&
        d.storage === storage
    );
    if (match) {
      setSelectedDevice(match);
      setStorageOptions(null);
      setImeiDeviceName(null);
    }
  };

  // ---- Start grading
  const handleGetQuote = () => {
    if (selectedDevice) {
      if (searchMode === "imei" && imeiInput.trim()) {
        setGradeImeiInput(imeiInput.replace(/[\s\-]/g, ""));
      }
      setStep("grade");
    }
  };

  // ---- Grading answers
  const handleGradeAnswer = (answer: "yes" | "no") => {
    const stepData = GRADING_STEPS.find((s) => s.id === currentGradeStep);
    if (!stepData) return;

    if (answer === "yes") {
      if (stepData.yesGrade) {
        setDeterminedGrade(stepData.yesGrade);
      } else if (stepData.yesNext) {
        setCurrentGradeStep(stepData.yesNext);
      }
    } else {
      if (stepData.noGrade) {
        setDeterminedGrade(stepData.noGrade);
      } else if (stepData.noNext) {
        setCurrentGradeStep(stepData.noNext);
      }
    }
  };

  // ---- Create quote when grade is determined
  const createQuote = useCallback(
    async (grade: string) => {
      if (!selectedDevice) return;

      setCreatingQuote(true);
      setError(null);

      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: selectedDevice.id,
            grade,
            imei: gradeImeiInput || null,
            displayCurrency: "AUD",
            referralCode: code,
            source: "embed",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setQuoteId(data.id);
          // Fetch full quote with device details
          setQuoteLoading(true);
          const quoteRes = await fetch(`/api/quote/${data.id}`);
          if (quoteRes.ok) {
            setQuote(await quoteRes.json());
          }
          setQuoteLoading(false);
          setStep("quote");
        } else {
          const errData = await res.json();
          setError(errData.error || "Failed to create quote");
          setCreatingQuote(false);
        }
      } catch {
        setError("Failed to create quote. Please try again.");
        setCreatingQuote(false);
      }
    },
    [selectedDevice, gradeImeiInput, code]
  );

  useEffect(() => {
    if (determinedGrade) {
      createQuote(determinedGrade);
    }
  }, [determinedGrade, createQuote]);

  // ---- Accept quote
  const handleAcceptQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddressParts: shippingAddress,
      paymentMethod,
      termsAccepted,
    };

    if (paymentMethod === "payid") {
      body.payIdPhone = payIdPhone;
    } else {
      body.bankBSB = bankBSB;
      body.bankAccountNumber = bankAccountNumber;
      body.bankAccountName = bankAccountName;
    }

    try {
      const res = await fetch(`/api/quote/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setQuote(data);
        setAccepted(true);
        setShowAcceptForm(false);
        setStep("confirmed");
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to accept quote");
      }
    } catch {
      setError("Failed to accept quote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Copy quote reference
  const handleCopyRef = () => {
    if (quoteId) {
      navigator.clipboard.writeText(quoteId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ---- Start over
  const handleStartOver = () => {
    setStep("search");
    setSelectedDevice(null);
    setQuery("");
    setImeiInput("");
    setImeiError(null);
    setStorageOptions(null);
    setCurrentGradeStep(1);
    setDeterminedGrade(null);
    setCreatingQuote(false);
    setGradeImeiInput("");
    setQuoteId(null);
    setQuote(null);
    setShowAcceptForm(false);
    setAccepted(false);
    setError(null);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setPaymentMethod("");
    setPayIdPhone("");
    setBankBSB("");
    setBankAccountNumber("");
    setBankAccountName("");
    setShippingAddress(EMPTY_AU_ADDRESS);
    setTermsAccepted(false);
  };

  // ---- Quote helpers
  const isExpired = quote?.expiresAt
    ? new Date(quote.expiresAt) < new Date()
    : false;

  // ---- Compute primary color CSS override
  const colorStyle: React.CSSProperties = config?.widgetPrimaryColor
    ? ({
        "--primary": hexToHSL(config.widgetPrimaryColor),
        "--ring": hexToHSL(config.widgetPrimaryColor),
      } as React.CSSProperties)
    : {};

  // ---- Loading
  if (configLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---- Invalid partner
  if (!config?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <Smartphone className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Widget Unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This trade-in widget is not currently active.
          </p>
        </div>
      </div>
    );
  }

  // ---- Render
  return (
    <div className="min-h-screen bg-background p-4" style={colorStyle}>
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6">
          {config.widgetLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.widgetLogoUrl}
              alt={config.partnerName}
              className="mb-3 h-8 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            {config.widgetCustomHeading || "Trade in your device for cash"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Powered by{" "}
            <a
              href="https://rhex.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-4 hover:underline"
            >
              rhex
            </a>
          </p>
        </div>

        {/* ============================================================= */}
        {/* STEP 1: Search */}
        {/* ============================================================= */}
        {step === "search" && (
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

            {/* Search Mode Tabs */}
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
              {/* Name Search */}
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
                        devicesLoading
                          ? "Loading devices..."
                          : "Search e.g. iPhone 15 128GB"
                      }
                      disabled={devicesLoading}
                      className="flex h-12 w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      autoComplete="off"
                    />
                    {devicesLoading && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Dropdown */}
                  {open && query.trim() && !devicesLoading && (
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
              )}

              {/* IMEI Search */}
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
                    Dial <span className="font-mono font-medium">*#06#</span> on
                    your phone to find your IMEI
                  </p>

                  {imeiError && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {imeiError}
                    </div>
                  )}

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
        )}

        {/* ============================================================= */}
        {/* STEP 2: Grading */}
        {/* ============================================================= */}
        {step === "grade" && (
          <div>
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              className="mb-4"
              onClick={() => {
                setStep("search");
                setCurrentGradeStep(1);
                setDeterminedGrade(null);
                setCreatingQuote(false);
                setError(null);
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {/* Device info */}
            {selectedDevice && (
              <div className="mb-6 rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {selectedDevice.make} {selectedDevice.model}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDevice.storage}
                    </p>
                  </div>
                </div>
                {!gradeImeiInput && (
                  <div className="mt-3 border-t pt-3">
                    <Label
                      htmlFor="grade-imei"
                      className="text-sm text-muted-foreground"
                    >
                      IMEI (optional)
                    </Label>
                    <Input
                      id="grade-imei"
                      value={gradeImeiInput}
                      onChange={(e) =>
                        setGradeImeiInput(
                          e.target.value.replace(/\D/g, "").slice(0, 15)
                        )
                      }
                      placeholder="Enter 15-digit IMEI"
                      className="mt-1"
                      maxLength={15}
                      inputMode="numeric"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Creating quote spinner */}
            {creatingQuote && (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                <p className="font-semibold">Creating your quote...</p>
              </div>
            )}

            {/* Error during quote creation */}
            {error && !creatingQuote && determinedGrade && (
              <div className="py-8 text-center">
                <p className="font-medium text-destructive">{error}</p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    setError(null);
                    setDeterminedGrade(null);
                    setCurrentGradeStep(1);
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Grading questionnaire */}
            {!creatingQuote && !determinedGrade && (() => {
              const stepData = GRADING_STEPS.find(
                (s) => s.id === currentGradeStep
              );
              if (!stepData) return null;
              const totalSteps = GRADING_STEPS.length;
              return (
                <>
                  {/* Progress */}
                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>Device Grading</span>
                      <span>
                        Step {currentGradeStep} of {totalSteps}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary transition-all duration-300"
                        style={{
                          width: `${(currentGradeStep / totalSteps) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Question Card */}
                  <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
                        {stepData.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">
                          {stepData.question}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {stepData.description}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-16 text-base font-medium"
                        onClick={() => handleGradeAnswer("yes")}
                      >
                        Yes
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-16 text-base font-medium"
                        onClick={() => handleGradeAnswer("no")}
                      >
                        No
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ============================================================= */}
        {/* STEP 3: Quote Result */}
        {/* ============================================================= */}
        {step === "quote" && (
          <div>
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              className="mb-4"
              onClick={() => {
                setStep("search");
                setCurrentGradeStep(1);
                setDeterminedGrade(null);
                setCreatingQuote(false);
                setQuoteId(null);
                setQuote(null);
                setShowAcceptForm(false);
                setError(null);
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Start Over
            </Button>

            {quoteLoading && (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading your quote...</p>
              </div>
            )}

            {quote && (
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                {/* Device Info */}
                {quote.device && (
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                      <Smartphone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">
                        {quote.device.make} {quote.device.model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {quote.device.storage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Price */}
                <div className="mb-6 rounded-lg bg-primary/5 p-6 text-center">
                  <p className="text-sm text-muted-foreground">Your Quote</p>
                  <p className="mt-1 text-4xl font-bold text-primary">
                    $
                    {(
                      quote.quotePriceDisplay ?? quote.quotePriceNZD
                    ).toFixed(2)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {quote.displayCurrency}
                  </p>
                </div>

                {/* Grade Badge */}
                <div className="mb-6 flex items-center justify-center gap-2">
                  <span className="text-sm text-muted-foreground">Grade:</span>
                  <Badge variant="secondary">
                    {quote.grade} —{" "}
                    {GRADE_LABELS[quote.grade as keyof typeof GRADE_LABELS] ??
                      quote.grade}
                  </Badge>
                </div>

                {/* Expiry */}
                {!isExpired && (
                  <div className="mb-6 flex items-center gap-2 rounded-lg border p-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Quote expires in{" "}
                      <span className="font-medium text-foreground">
                        {formatTimeLeft(quote.expiresAt)}
                      </span>
                    </p>
                  </div>
                )}

                {isExpired && (
                  <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <p className="text-sm font-medium text-destructive">
                      This quote has expired.
                    </p>
                    <Button
                      onClick={handleStartOver}
                      size="sm"
                      className="mt-3"
                    >
                      Get New Quote
                    </Button>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {/* Accept Button */}
                {!accepted && !isExpired && !showAcceptForm && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setShowAcceptForm(true)}
                  >
                    Accept Quote
                    <Check className="ml-2 h-4 w-4" />
                  </Button>
                )}

                {/* Accept Form */}
                {showAcceptForm && !accepted && (
                  <form onSubmit={handleAcceptQuote} className="space-y-4">
                    <div className="mb-2 border-t pt-4">
                      <h3 className="font-semibold">Your Details</h3>
                      <p className="text-sm text-muted-foreground">
                        Fill in your details to accept this quote.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="w-name">Full Name</Label>
                      <Input
                        id="w-name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="John Smith"
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="w-email">Email</Label>
                      <Input
                        id="w-email"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="john@example.com"
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="w-phone">Mobile Number</Label>
                      <Input
                        id="w-phone"
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="04XX XXX XXX"
                        required
                        className="mt-1"
                      />
                    </div>

                    <AuAddressFields
                      idPrefix="w-address"
                      value={shippingAddress}
                      onChange={setShippingAddress}
                      hint="Australia only. Used for your shipping label and any return of your device."
                    />

                    <div>
                      <Label>Payment Method</Label>
                      <Select
                        value={paymentMethod}
                        onValueChange={setPaymentMethod}
                      >
                        <SelectTrigger className="mt-1 w-full">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="payid">PayID</SelectItem>
                          <SelectItem value="bank_transfer">
                            Bank Transfer
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {paymentMethod === "payid" && (
                      <div className="space-y-2">
                        <Label htmlFor="w-payid">PayID Mobile Number</Label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={
                              payIdPhone === customerPhone &&
                              customerPhone !== ""
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPayIdPhone(customerPhone);
                              } else {
                                setPayIdPhone("");
                              }
                            }}
                            className="rounded border-input"
                          />
                          Same as mobile number above
                        </label>
                        <Input
                          id="w-payid"
                          type="tel"
                          value={payIdPhone}
                          onChange={(e) => setPayIdPhone(e.target.value)}
                          placeholder="04XX XXX XXX"
                          required
                        />
                      </div>
                    )}

                    {paymentMethod === "bank_transfer" && (
                      <>
                        <div>
                          <Label htmlFor="w-bsb">BSB</Label>
                          <Input
                            id="w-bsb"
                            value={bankBSB}
                            onChange={(e) => setBankBSB(e.target.value)}
                            placeholder="XXX-XXX"
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="w-acct-num">Account Number</Label>
                          <Input
                            id="w-acct-num"
                            value={bankAccountNumber}
                            onChange={(e) =>
                              setBankAccountNumber(e.target.value)
                            }
                            placeholder="XXXXXXXX"
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="w-acct-name">Account Name</Label>
                          <Input
                            id="w-acct-name"
                            value={bankAccountName}
                            onChange={(e) => setBankAccountName(e.target.value)}
                            placeholder="John Smith"
                            required
                            className="mt-1"
                          />
                        </div>
                      </>
                    )}

                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        required
                        className="mt-0.5 rounded border-input"
                      />
                      <span>
                        I agree to the{" "}
                        <a
                          href="https://rhex.app/terms/trade-in"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4 hover:text-primary"
                        >
                          Trade-In Terms &amp; Conditions
                        </a>
                      </span>
                    </label>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowAcceptForm(false);
                          setError(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={
                          submitting ||
                          !paymentMethod ||
                          !termsAccepted ||
                          !isAuAddressComplete(shippingAddress)
                        }
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            Confirm
                            <Check className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* STEP 4: Confirmed */}
        {/* ============================================================= */}
        {step === "confirmed" && quote && (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300">
                    Quote Accepted
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Your quote has been confirmed. We&apos;ll email your
                    prepaid shipping label shortly.
                  </p>
                </div>
              </div>
            </div>

            {/* Quote Reference */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Quote Reference</h3>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                <code className="flex-1 text-sm font-mono break-all">
                  {quoteId}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyRef}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <TradeInShippingInstructions quoteId={quote.id} />

            {/* Trade in another */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleStartOver}
            >
              Trade in another device
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a
            href="https://rhex.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            rhex
          </a>
          {" · "}
          <a
            href="https://rhex.app/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terms
          </a>
          {" · "}
          <a
            href="https://rhex.app/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Privacy
          </a>
        </div>
      </div>
    </div>
  );
}
