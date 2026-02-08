"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Smartphone,
  Power,
  MonitorSmartphone,
  Settings,
  Sparkles,
  ArrowLeft,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    description:
      "Try powering on the device. Does it boot up and show the home screen?",
    icon: <Power className="h-6 w-6" />,
    noGrade: "E",
    yesNext: 2,
  },
  {
    id: 2,
    question: "Does the screen have issues?",
    description:
      "Check for cracks, dead pixels, discoloration, burn-in, or touch responsiveness problems.",
    icon: <MonitorSmartphone className="h-6 w-6" />,
    yesGrade: "D",
    noNext: 3,
  },
  {
    id: 3,
    question: "Any functional issues or noticeable wear?",
    description:
      "Check for issues like faulty buttons, poor battery life, speaker problems, dents, or deep scratches.",
    icon: <Settings className="h-6 w-6" />,
    yesGrade: "C",
    noNext: 4,
  },
  {
    id: 4,
    question: "Any minor wear or light scratches?",
    description:
      "Look closely for small cosmetic marks, light scratches on the screen or body, or minor signs of use.",
    icon: <Sparkles className="h-6 w-6" />,
    yesGrade: "B",
    noGrade: "A",
  },
];

const GRADE_LABELS: Record<string, string> = {
  A: "Excellent",
  B: "Good",
  C: "Fair",
  D: "Screen Issues",
  E: "No Power",
};

function QuotePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("device");

  const [device, setDevice] = useState<Device | null>(null);
  const [loadingDevice, setLoadingDevice] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [determinedGrade, setDeterminedGrade] = useState<string | null>(null);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch device info
  useEffect(() => {
    if (!deviceId) {
      setLoadingDevice(false);
      return;
    }

    async function fetchDevice() {
      try {
        const res = await fetch(`/api/devices?id=${deviceId}`);
        if (res.ok) {
          const data = await res.json();
          setDevice(data);
        } else {
          setError("Device not found");
        }
      } catch (err) {
        console.error("Failed to fetch device:", err);
        setError("Failed to load device information");
      } finally {
        setLoadingDevice(false);
      }
    }
    fetchDevice();
  }, [deviceId]);

  // Create quote once grade is determined
  const createQuote = useCallback(
    async (grade: string) => {
      if (!deviceId) return;

      setCreatingQuote(true);
      setError(null);

      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, grade }),
        });

        if (res.ok) {
          const data = await res.json();
          router.push(`/quote/${data.id}`);
        } else {
          const errData = await res.json();
          setError(errData.error || "Failed to create quote");
          setCreatingQuote(false);
        }
      } catch (err) {
        console.error("Failed to create quote:", err);
        setError("Failed to create quote. Please try again.");
        setCreatingQuote(false);
      }
    },
    [deviceId, router]
  );

  // Handle grade determination
  useEffect(() => {
    if (determinedGrade) {
      createQuote(determinedGrade);
    }
  }, [determinedGrade, createQuote]);

  const handleAnswer = (answer: "yes" | "no") => {
    const step = GRADING_STEPS.find((s) => s.id === currentStep);
    if (!step) return;

    if (answer === "yes") {
      if (step.yesGrade) {
        setDeterminedGrade(step.yesGrade);
      } else if (step.yesNext) {
        setCurrentStep(step.yesNext);
      }
    } else {
      if (step.noGrade) {
        setDeterminedGrade(step.noGrade);
      } else if (step.noNext) {
        setCurrentStep(step.noNext);
      }
    }
  };

  // No device ID provided
  if (!deviceId) {
    return (
      <main className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </header>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <Smartphone className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-xl font-semibold">No device selected</h1>
          <p className="mt-2 text-muted-foreground">
            Please select a device from the home page to get a quote.
          </p>
          <Button className="mt-6" onClick={() => router.push("/")}>
            Go to Home
          </Button>
        </div>
      </main>
    );
  }

  // Loading state
  if (loadingDevice) {
    return (
      <main className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </header>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading device information...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error && !device) {
    return (
      <main className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </header>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-destructive">Error</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Button className="mt-6" onClick={() => router.push("/")}>
            Go to Home
          </Button>
        </div>
      </main>
    );
  }

  const currentStepData = GRADING_STEPS.find((s) => s.id === currentStep);
  const totalSteps = GRADING_STEPS.length;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">
              <span className="text-primary">rhex</span>{" "}
              <span className="text-muted-foreground">Trade-In</span>
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Device Info */}
        {device && (
          <div className="mb-8 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">
                  {device.make} {device.model}
                </p>
                <p className="text-sm text-muted-foreground">
                  {device.storage}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Creating quote state */}
        {creatingQuote && (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="font-semibold">Creating your quote...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Device graded as{" "}
              <span className="font-medium">
                {determinedGrade} - {GRADE_LABELS[determinedGrade!]}
              </span>
            </p>
          </div>
        )}

        {/* Error during quote creation */}
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

        {/* Grading Questionnaire */}
        {!creatingQuote && !determinedGrade && currentStepData && (
          <>
            {/* Progress */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>Device Grading</span>
                <span>
                  Step {currentStep} of {totalSteps}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-300"
                  style={{
                    width: `${(currentStep / totalSteps) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Question Card */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
                  {currentStepData.icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {currentStepData.question}
                  </h2>
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
            </div>

            {/* Grade Legend */}
            <div className="mt-8">
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                Grade scale
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(GRADE_LABELS).map(([grade, label]) => (
                  <Badge
                    key={grade}
                    variant="outline"
                    className={cn(
                      "text-xs",
                      currentStep > 1 && "opacity-60"
                    )}
                  >
                    {grade}: {label}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function QuotePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background">
          <div className="mx-auto max-w-lg px-4 py-16 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      }
    >
      <QuotePageContent />
    </Suspense>
  );
}
