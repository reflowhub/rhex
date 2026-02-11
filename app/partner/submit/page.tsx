"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePartner } from "@/lib/partner-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Smartphone,
  Search,
  Power,
  MonitorSmartphone,
  Settings,
  Sparkles,
  Loader2,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Device {
  id: string;
  make: string;
  model: string;
  storage: string;
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

const GRADING_STEPS: GradingStep[] = [
  {
    id: 1,
    question: "Does the phone turn on?",
    description: "Try powering on the device. Does it boot up and show the home screen?",
    icon: <Power className="h-6 w-6" />,
    noGrade: "E",
    yesNext: 2,
  },
  {
    id: 2,
    question: "Does the screen have issues?",
    description: "Check for cracks, dead pixels, discoloration, burn-in, or touch responsiveness problems.",
    icon: <MonitorSmartphone className="h-6 w-6" />,
    yesGrade: "D",
    noNext: 3,
  },
  {
    id: 3,
    question: "Any functional issues or noticeable wear?",
    description: "Check for issues like faulty buttons, poor battery life, speaker problems, dents, or deep scratches.",
    icon: <Settings className="h-6 w-6" />,
    yesGrade: "C",
    noNext: 4,
  },
  {
    id: 4,
    question: "Any minor wear or light scratches?",
    description: "Look closely for small cosmetic marks, light scratches on the screen or body, or minor signs of use.",
    icon: <Sparkles className="h-6 w-6" />,
    yesGrade: "B",
    noGrade: "A",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartnerSubmitPage() {
  const router = useRouter();
  const { partner, loading: partnerLoading } = usePartner();

  // Device search
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Grading
  const [currentStep, setCurrentStep] = useState(1);
  const [determinedGrade, setDeterminedGrade] = useState<string | null>(null);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not Mode B
  useEffect(() => {
    if (!partnerLoading && partner && !partner.modes.includes("B")) {
      router.push("/partner/dashboard");
    }
  }, [partner, partnerLoading, router]);

  // Fetch devices
  useEffect(() => {
    fetch("/api/devices")
      .then((res) => res.json())
      .then((data) => setDevices(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setDevicesLoading(false));
  }, []);

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

  useEffect(() => setHighlightIndex(0), [filtered]);

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

  // Create quote
  const createQuote = useCallback(
    async (grade: string) => {
      if (!selectedDevice) return;
      setCreatingQuote(true);
      setError(null);

      try {
        const res = await fetch("/api/partner/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: selectedDevice.id, grade }),
        });

        if (res.ok) {
          const data = await res.json();
          router.push(`/partner/quotes/${data.id}`);
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
    [selectedDevice, router]
  );

  useEffect(() => {
    if (determinedGrade) createQuote(determinedGrade);
  }, [determinedGrade, createQuote]);

  const handleAnswer = (answer: "yes" | "no") => {
    const step = GRADING_STEPS.find((s) => s.id === currentStep);
    if (!step) return;
    if (answer === "yes") {
      if (step.yesGrade) setDeterminedGrade(step.yesGrade);
      else if (step.yesNext) setCurrentStep(step.yesNext);
    } else {
      if (step.noGrade) setDeterminedGrade(step.noGrade);
      else if (step.noNext) setCurrentStep(step.noNext);
    }
  };

  if (partnerLoading || !partner) return null;
  if (!partner.modes.includes("B")) return null;

  const showGrading = selectedDevice && !determinedGrade && !creatingQuote;
  const currentStepData = GRADING_STEPS.find((s) => s.id === currentStep);

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Submit Trade-In</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a single device at your partner rate
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-lg">
        {/* Device Search */}
        {!selectedDevice && (
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="mb-3 text-sm font-medium">Search for a device</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
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

            {open && query.trim() && !devicesLoading && (
              <ul
                ref={listRef}
                className="mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
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
                        i === highlightIndex && "bg-accent text-accent-foreground"
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

        {/* Selected device */}
        {selectedDevice && (
          <div className="mb-6 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">
                  {selectedDevice.make} {selectedDevice.model}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedDevice.storage}
                </p>
              </div>
              {!determinedGrade && !creatingQuote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDevice(null);
                    setQuery("");
                    setCurrentStep(1);
                    setDeterminedGrade(null);
                    setError(null);
                  }}
                >
                  Change
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Creating quote */}
        {creatingQuote && (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="font-semibold">Creating your trade-in quote...</p>
          </div>
        )}

        {/* Error */}
        {error && !creatingQuote && determinedGrade && (
          <div className="py-8 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <Button
              className="mt-4"
              onClick={() => {
                setError(null);
                setDeterminedGrade(null);
                setCurrentStep(1);
              }}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Grading */}
        {showGrading && currentStepData && (
          <>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>Device Grading</span>
                <span>Step {currentStep} of {GRADING_STEPS.length}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(currentStep / GRADING_STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
                  {currentStepData.icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{currentStepData.question}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currentStepData.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-16 text-base font-medium"
                  onClick={() => handleAnswer("yes")}
                >
                  Yes
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-16 text-base font-medium"
                  onClick={() => handleAnswer("no")}
                >
                  No
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 text-center">
                <Badge variant="secondary" className="text-xs">
                  Partner rate ({100 - (partner.partnerRateDiscount ?? 10)}% of public payout)
                </Badge>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
