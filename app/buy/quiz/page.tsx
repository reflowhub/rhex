"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Smartphone,
  Loader2,
  RotateCcw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";
import {
  IPHONE_MODEL_MAP,
  type Tier,
  type Size,
  type Usage,
  type IPhoneSpecs,
} from "@/lib/iphone-specs";
import { toModelSlug } from "@/lib/slugify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductGroup {
  slug: string;
  make: string;
  model: string;
  category: string;
  minPriceAUD: number;
  unitCount: number;
  storages: string[];
  grades: string[];
  heroImage: string | null;
  fallbackImage: string | null;
}

interface QuizAnswers {
  budget: string | null;
  usage: string | null;
  features: string[];
  size: string | null;
  storage: string | null;
}

interface ScoredResult {
  group: ProductGroup;
  highlight: string;
  specs: IPhoneSpecs;
  score: number;
}

// ---------------------------------------------------------------------------
// Quiz questions
// ---------------------------------------------------------------------------

interface QuizOption {
  value: string;
  label: string;
  description: string;
}

interface QuizStep {
  key: keyof QuizAnswers;
  question: string;
  subtitle: string;
  options: QuizOption[];
  /** If true, allows selecting multiple options (requires manual "Next"). */
  multiSelect?: boolean;
}

const STEPS: QuizStep[] = [
  {
    key: "budget",
    question: "What's your budget?",
    subtitle: "We'll find iPhones that fit your price range.",
    options: [
      {
        value: "under-300",
        label: "Under $300",
        description: "Older models, great value",
      },
      {
        value: "300-500",
        label: "$300 – $500",
        description: "Mid-range, solid performance",
      },
      {
        value: "500-800",
        label: "$500 – $800",
        description: "Recent models, premium features",
      },
      {
        value: "over-800",
        label: "Over $800",
        description: "Latest & greatest, top specs",
      },
    ],
  },
  {
    key: "usage",
    question: "What do you use your phone for most?",
    subtitle: "This helps us match you with the right features.",
    options: [
      {
        value: "basic",
        label: "The basics",
        description: "Calls, texts, social media, browsing",
      },
      {
        value: "everyday",
        label: "A bit of everything",
        description: "Photos, streaming, apps, and more",
      },
      {
        value: "power",
        label: "Power user",
        description: "Gaming, video editing, pro photography",
      },
    ],
  },
  {
    key: "features",
    question: "Which features matter most to you?",
    subtitle: "Pick as many as you like, or skip if you're not sure.",
    multiSelect: true,
    options: [
      {
        value: "camera",
        label: "Great camera",
        description: "Pro-level photos and video",
      },
      {
        value: "usb-c",
        label: "USB-C",
        description: "Universal charging, no Lightning",
      },
      {
        value: "promotion",
        label: "Smooth display (120Hz)",
        description: "ProMotion for fluid scrolling",
      },
      {
        value: "always-on",
        label: "Always-on display",
        description: "See time and notifications at a glance",
      },
      {
        value: "apple-intelligence",
        label: "Apple Intelligence",
        description: "AI writing tools, smart summaries, Siri upgrades",
      },
      {
        value: "dynamic-island",
        label: "Dynamic Island",
        description: "Live activities and notifications in the notch",
      },
    ],
  },
  {
    key: "size",
    question: "What screen size do you prefer?",
    subtitle: "Pick what feels right in your hand.",
    options: [
      {
        value: "compact",
        label: "Compact",
        description: "Easy one-hand use, pocket-friendly",
      },
      {
        value: "standard",
        label: "Standard",
        description: "Balanced size for most people",
      },
      {
        value: "large",
        label: "Large",
        description: "Big screen for media and multitasking",
      },
    ],
  },
  {
    key: "storage",
    question: "How much storage do you need?",
    subtitle: "Think about photos, apps, and downloads.",
    options: [
      {
        value: "low",
        label: "128GB or less",
        description: "Light use — streaming over downloading",
      },
      {
        value: "mid",
        label: "256GB",
        description: "Room for photos, apps, and some video",
      },
      {
        value: "high",
        label: "512GB or more",
        description: "Lots of media, games, or pro workflows",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Feature → spec keyword mapping
// ---------------------------------------------------------------------------

/**
 * Maps quiz feature option values to keywords checked against
 * IPhoneSpecs.features and IPhoneSpecs.display/camera.
 */
const FEATURE_KEYWORDS: Record<string, string[]> = {
  camera: ["ProRes", "LiDAR", "48MP", "telephoto"],
  "usb-c": ["USB-C"],
  promotion: ["ProMotion"],
  "always-on": ["Always-On"],
  "apple-intelligence": ["Apple Intelligence"],
  "dynamic-island": ["Dynamic Island"],
};

function modelHasFeature(specs: IPhoneSpecs, featureKey: string): boolean {
  const keywords = FEATURE_KEYWORDS[featureKey];
  if (!keywords) return false;

  const searchable = [
    ...specs.features,
    specs.display,
    specs.camera,
  ];

  return keywords.some((kw) =>
    searchable.some((s) => s.toLowerCase().includes(kw.toLowerCase()))
  );
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** Budget ranges in AUD (minPriceAUD thresholds). */
function budgetMatches(minPriceAUD: number, budget: string): boolean {
  switch (budget) {
    case "under-300":
      return minPriceAUD < 350;
    case "300-500":
      return minPriceAUD >= 150 && minPriceAUD <= 550;
    case "500-800":
      return minPriceAUD >= 350 && minPriceAUD <= 850;
    case "over-800":
      return minPriceAUD >= 550;
    default:
      return true;
  }
}

/** Check if a model has storage options that match the user's preference. */
function storageMatches(storages: string[], pref: string): boolean {
  const parse = (s: string) => parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
  const sizes = storages.map(parse);

  switch (pref) {
    case "low":
      return sizes.some((s) => s <= 128);
    case "mid":
      return sizes.some((s) => s === 256);
    case "high":
      return sizes.some((s) => s >= 512);
    default:
      return true;
  }
}

function scoreModel(
  group: ProductGroup,
  answers: QuizAnswers
): ScoredResult | null {
  const spec = IPHONE_MODEL_MAP.get(group.model);
  if (!spec) return null;

  // Hard filter: budget must match
  if (answers.budget && !budgetMatches(group.minPriceAUD, answers.budget)) {
    return null;
  }

  let score = 0;

  // Usage match
  if (answers.usage && spec.usage === (answers.usage as Usage)) {
    score += 3;
  } else if (answers.usage) {
    const usageTiers: Record<string, number> = {
      basic: 0,
      everyday: 1,
      power: 2,
    };
    const diff = Math.abs(
      (usageTiers[spec.usage] ?? 1) - (usageTiers[answers.usage] ?? 1)
    );
    if (diff === 1) score += 1;
  }

  // Feature matches — 1.5 points per matched feature
  if (answers.features.length > 0) {
    for (const f of answers.features) {
      if (modelHasFeature(spec.specs, f)) {
        score += 1.5;
      }
    }
  }

  // Size match
  if (answers.size && spec.size === (answers.size as Size)) {
    score += 2;
  } else if (answers.size) {
    const sizeTiers: Record<string, number> = {
      compact: 0,
      standard: 1,
      large: 2,
    };
    const diff = Math.abs(
      (sizeTiers[spec.size] ?? 1) - (sizeTiers[answers.size] ?? 1)
    );
    if (diff === 1) score += 1;
  }

  // Storage match
  if (answers.storage && storageMatches(group.storages, answers.storage)) {
    score += 2;
  }

  // Slight bonus for newer models
  const tierBonus: Record<Tier, number> = { budget: 0, mid: 0.5, premium: 1 };
  if (answers.budget === "over-800") {
    score += tierBonus[spec.tier] ?? 0;
  }

  return { group, highlight: spec.highlight, specs: spec.specs, score };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuizPage() {
  const { currency, convertFromAUD } = useCurrency();
  const [expanded, setExpanded] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({
    budget: null,
    usage: null,
    features: [],
    size: null,
    storage: null,
  });
  const [showResults, setShowResults] = useState(false);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const currentStep = STEPS[step];
  const isMultiSelect = currentStep?.multiSelect === true;

  // Fetch iPhone inventory (once, when results are needed)
  const fetchGroups = useCallback(() => {
    setLoading(true);
    fetch("/api/buy/products/grouped?category=Phone")
      .then((res) => res.json())
      .then((data) => {
        if (data.groups) setGroups(data.groups);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // When all questions answered → fetch inventory & show results
  useEffect(() => {
    if (showResults && groups.length === 0) {
      fetchGroups();
    }
  }, [showResults, groups.length, fetchGroups]);

  // --- single-select handler (auto-advances) ---
  const handleSingleSelect = (key: keyof QuizAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));

    if (step < STEPS.length - 1) {
      setTimeout(() => setStep(step + 1), 200);
    } else {
      setTimeout(() => setShowResults(true), 200);
    }
  };

  // --- multi-select toggle ---
  const handleMultiToggle = (value: string) => {
    setAnswers((prev) => {
      const current = prev.features;
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, features: next };
    });
  };

  // --- advance from multi-select step ---
  const handleMultiNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setShowResults(true);
    }
  };

  const handleBack = () => {
    if (showResults) {
      setShowResults(false);
    } else if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleStartOver = () => {
    setStep(0);
    setAnswers({
      budget: null,
      usage: null,
      features: [],
      size: null,
      storage: null,
    });
    setShowResults(false);
    setExpanded(null);
  };

  const formatPrice = (priceAUD: number) => {
    const displayPrice =
      currency === "AUD" ? priceAUD : convertFromAUD(priceAUD);
    return new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-NZ", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(displayPrice);
  };

  // ---- Compute results ------------------------------------------------------
  const results: ScoredResult[] = showResults
    ? groups
        .filter((g) => g.make === "Apple" && IPHONE_MODEL_MAP.has(g.model))
        .map((g) => scoreModel(g, answers))
        .filter((r): r is ScoredResult => r !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    : [];

  // For result cards: which features from the user's picks does each model have?
  const getMatchedFeatures = (specs: IPhoneSpecs) =>
    answers.features.filter((f) => modelHasFeature(specs, f));

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/buy/browse"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Browse
      </Link>

      {/* Header */}
      <div className="mt-6">
        <h1 className="text-2xl font-medium tracking-tight">
          Find Your iPhone
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer a few questions and we&apos;ll recommend the best match from
          our available inventory.
        </p>
      </div>

      {/* Progress bar */}
      {!showResults && (
        <div className="mt-6 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-foreground" : "bg-border"
              )}
            />
          ))}
        </div>
      )}

      {/* Quiz steps */}
      {!showResults && (
        <div className="mt-8">
          <p className="text-xs text-muted-foreground">
            Question {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-2 text-xl font-medium">
            {currentStep.question}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentStep.subtitle}
          </p>

          {/* Options grid */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {currentStep.options.map((option) => {
              const isSelected = isMultiSelect
                ? answers.features.includes(option.value)
                : answers[currentStep.key] === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() =>
                    isMultiSelect
                      ? handleMultiToggle(option.value)
                      : handleSingleSelect(currentStep.key, option.value)
                  }
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    isSelected
                      ? "border-foreground bg-card"
                      : "border-border bg-card hover:border-foreground/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {option.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    {isMultiSelect && isSelected && (
                      <Check className="h-4 w-4 flex-shrink-0 text-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className={cn(
                "inline-flex items-center gap-1 text-sm transition-colors",
                step === 0
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            {isMultiSelect ? (
              <button
                onClick={handleMultiNext}
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
              >
                {answers.features.length === 0 ? "Skip" : "Next"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              answers[currentStep.key] &&
              step < STEPS.length - 1 && (
                <button
                  onClick={() => setStep(step + 1)}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            <>
              <h2 className="text-xl font-medium">
                {results.length === 1
                  ? "Our top pick for you"
                  : `Our top ${results.length} picks for you`}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on your preferences, these are the best matches from our
                current inventory.
              </p>

              <div className="mt-6 grid gap-4">
                {results.map(({ group, highlight, specs }, i) => {
                  const isExpanded = expanded === group.slug;
                  const matched = getMatchedFeatures(specs);

                  return (
                    <div
                      key={group.slug}
                      className={cn(
                        "rounded-lg border bg-card transition-colors",
                        i === 0 ? "border-foreground/30" : "border-border"
                      )}
                    >
                      {/* Main card — clickable to expand/collapse specs */}
                      <button
                        onClick={() =>
                          setExpanded(isExpanded ? null : group.slug)
                        }
                        className="group flex w-full gap-4 p-4 text-left"
                      >
                        {/* Image */}
                        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded bg-background sm:h-28 sm:w-28">
                          {group.heroImage ? (
                            <img
                              src={group.heroImage}
                              alt={`${group.make} ${group.model}`}
                              className="h-full w-full object-contain"
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (
                                  group.fallbackImage &&
                                  img.src !== group.fallbackImage
                                ) {
                                  img.src = group.fallbackImage;
                                } else {
                                  img.style.display = "none";
                                }
                              }}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                              <Smartphone className="h-10 w-10" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex flex-1 flex-col justify-center min-w-0">
                          {i === 0 && (
                            <p className="text-xs font-medium text-primary">
                              Best Match
                            </p>
                          )}
                          <p className="font-medium text-foreground">
                            {group.make} {group.model}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {highlight}
                          </p>

                          {/* Matched feature indicators */}
                          {matched.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {matched.map((f) => {
                                const opt = STEPS[2].options.find(
                                  (o) => o.value === f
                                );
                                return (
                                  <span
                                    key={f}
                                    className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                                  >
                                    <Check className="h-2.5 w-2.5" />
                                    {opt?.label ?? f}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          <div className="mt-2 flex items-baseline gap-2">
                            <p className="text-lg font-medium tabular-nums text-foreground">
                              from {formatPrice(group.minPriceAUD)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {group.unitCount}{" "}
                              {group.unitCount === 1 ? "unit" : "units"}{" "}
                              available
                            </p>
                          </div>
                        </div>

                        {/* Expand indicator */}
                        <div className="flex flex-shrink-0 items-center self-center">
                          <svg
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              isExpanded && "rotate-180"
                            )}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded specs panel */}
                      {isExpanded && (
                        <div className="border-t border-border px-4 pb-4 pt-3">
                          {/* Spec rows */}
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                            <span className="text-muted-foreground">
                              Display
                            </span>
                            <span className="text-foreground">
                              {specs.display}
                            </span>
                            <span className="text-muted-foreground">Chip</span>
                            <span className="text-foreground">
                              {specs.chip}
                            </span>
                            <span className="text-muted-foreground">
                              Camera
                            </span>
                            <span className="text-foreground">
                              {specs.camera}
                            </span>
                            <span className="text-muted-foreground">
                              Storage
                            </span>
                            <span className="text-foreground">
                              {group.storages.join(", ")}
                            </span>
                          </div>

                          {/* Feature tags */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {specs.features.map((f) => (
                              <span
                                key={f}
                                className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground"
                              >
                                {f}
                              </span>
                            ))}
                          </div>

                          {/* View devices link */}
                          <Link
                            href={`/buy/model/${group.slug}`}
                            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                          >
                            View available units
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium text-foreground">
                No exact matches right now
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your preferences or browse all available devices.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleStartOver}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Start Over
            </Button>
            <Button variant="outline" asChild>
              <Link href="/buy/browse">Browse All Devices</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
