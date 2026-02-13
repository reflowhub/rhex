"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Upload,
  Calculator,
  HandCoins,
  ArrowRight,
  FileSpreadsheet,
  ClipboardCheck,
  Package,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";

export default function BusinessPage() {
  const { currency, setCurrency } = useCurrency();

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Link href="/sell" className="flex items-center gap-2.5">
              <Image
                src="/logo-rhex.svg"
                alt="rhex"
                width={28}
                height={28}
                className="h-7 w-7"
              />
              <span className="text-xl font-bold tracking-tight">
                Trade-In
              </span>
            </Link>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Business
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sell"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Personal
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
        <div className="relative mx-auto max-w-5xl px-4 py-16 md:py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Bulk Trade-In{" "}
              <span className="text-primary">Estimator</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Upload your device manifest and get an instant indicative quote
              for your entire fleet. No commitment required.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-sm text-center">
            <Button size="lg" className="w-full" asChild>
              <Link href="/sell/business/estimate">
                Start Estimate
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
              Or{" "}
              <Link href="/sell" className="text-primary hover:underline">
                trade in a single device
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="border-t bg-card py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 sm:grid-cols-3">
          {[
            {
              icon: Upload,
              title: "Upload a manifest",
              desc: "CSV or XLSX — drop your device list and we'll match it to our library automatically.",
            },
            {
              icon: Calculator,
              title: "Instant estimate",
              desc: "Per-device pricing breakdown with total lot value. Export as CSV for internal review.",
            },
            {
              icon: HandCoins,
              title: "No commitment",
              desc: "Use it as an estimator tool. Walk away or accept and ship when you're ready.",
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

      {/* How it works */}
      <section className="border-t py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold">
            How it works
          </h2>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "1",
                icon: FileSpreadsheet,
                title: "Upload your manifest",
                desc: "Drop a CSV or XLSX file with your device list — model names, quantities, and storage.",
              },
              {
                step: "2",
                icon: ClipboardCheck,
                title: "Review matches",
                desc: "We auto-match devices to our library. Resolve any unmatched items manually.",
              },
              {
                step: "3",
                icon: Package,
                title: "Accept & ship",
                desc: "Happy with the estimate? Accept it, then ship devices to us for inspection.",
              },
              {
                step: "4",
                icon: Banknote,
                title: "Get paid",
                desc: "We inspect each device and pay the final amount via PayID or bank transfer.",
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
    </main>
  );
}
