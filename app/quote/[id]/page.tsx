"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Smartphone,
  ArrowLeft,
  Loader2,
  Check,
  Package,
  Clock,
  CreditCard,
  Copy,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

interface QuoteData {
  id: string;
  deviceId: string;
  grade: string;
  quotePriceNZD: number;
  displayCurrency: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentMethod?: string;
  device?: {
    id: string;
    make: string;
    model: string;
    storage: string;
  };
}

const GRADE_LABELS: Record<string, string> = {
  A: "Excellent",
  B: "Good",
  C: "Fair",
  D: "Screen Issues",
  E: "No Power",
};

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-200",
  D: "bg-orange-100 text-orange-800 border-orange-200",
  E: "bg-red-100 text-red-800 border-red-200",
};

export default function QuoteResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [payIdPhone, setPayIdPhone] = useState("");
  const [bankBSB, setBankBSB] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  // Fetch quote
  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch(`/api/quote/${id}`);
        if (res.ok) {
          const data = await res.json();
          setQuote(data);
          if (data.status === "accepted") {
            setAccepted(true);
          }
        } else {
          const errData = await res.json();
          setError(errData.error || "Failed to load quote");
        }
      } catch (err) {
        console.error("Failed to fetch quote:", err);
        setError("Failed to load quote");
      } finally {
        setLoading(false);
      }
    }
    fetchQuote();
  }, [id]);

  const handleAcceptQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body: Record<string, string> = {
      customerName,
      customerEmail,
      customerPhone,
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
      const res = await fetch(`/api/quote/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setQuote(data);
        setAccepted(true);
        setShowAcceptForm(false);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to accept quote");
      }
    } catch (err) {
      console.error("Failed to accept quote:", err);
      setError("Failed to accept quote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyRef = () => {
    if (quote?.id) {
      navigator.clipboard.writeText(quote.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isExpired = quote?.expiresAt
    ? new Date(quote.expiresAt) < new Date()
    : false;

  const daysUntilExpiry = quote?.expiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(quote.expiresAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  // Loading state
  if (loading) {
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
          <p className="text-muted-foreground">Loading your quote...</p>
        </div>
      </main>
    );
  }

  // Error state (no quote loaded)
  if (!quote) {
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
          <h1 className="text-xl font-semibold text-destructive">
            Quote not found
          </h1>
          <p className="mt-2 text-muted-foreground">
            {error || "The quote you are looking for does not exist."}
          </p>
          <Button className="mt-6" onClick={() => router.push("/")}>
            Get a New Quote
          </Button>
        </div>
      </main>
    );
  }

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
            <Image
              src="/logo-rhex.svg"
              alt="rhex"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="text-sm font-bold tracking-tight">Trade-In</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Accepted Confirmation */}
        {accepted && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-800">Quote Accepted</p>
                <p className="text-sm text-green-700">
                  Your quote has been confirmed. Follow the shipping
                  instructions below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quote Result Card */}
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
              ${quote.quotePriceNZD.toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {quote.displayCurrency}
            </p>
          </div>

          {/* Expiry Notice */}
          {!accepted && !isExpired && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border p-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Quote expires in{" "}
                <span className="font-medium text-foreground">
                  {daysUntilExpiry} days
                </span>
              </p>
            </div>
          )}

          {isExpired && !accepted && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm text-destructive font-medium">
                This quote has expired. Please create a new quote.
              </p>
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
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Smith"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="04XX XXX XXX"
                  required
                  className="mt-1"
                />
              </div>

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

              {/* PayID Fields */}
              {paymentMethod === "payid" && (
                <div>
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

              {/* Bank Transfer Fields */}
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
                    <Label htmlFor="account-number">Account Number</Label>
                    <Input
                      id="account-number"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="XXXXXXXX"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-name">Account Name</Label>
                    <Input
                      id="account-name"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="John Smith"
                      required
                      className="mt-1"
                    />
                  </div>
                </>
              )}

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
                  disabled={submitting || !paymentMethod}
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

        {/* Post-Acceptance Details */}
        {accepted && (
          <div className="mt-6 space-y-4">
            {/* Quote Reference */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Quote Reference</h3>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                <code className="flex-1 text-sm font-mono break-all">
                  {quote.id}
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

            {/* Shipping Instructions */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Shipping Instructions</h3>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Ship your device to:</p>
                <div className="rounded-lg bg-muted p-3">
                  <p className="font-medium text-foreground">
                    rhex Trade-In Program
                  </p>
                  <p>[Address]</p>
                  <p>[City, State, Postcode]</p>
                </div>
                <p>
                  Please include your quote reference number{" "}
                  <span className="font-medium text-foreground font-mono">
                    {quote.id.slice(0, 8)}...
                  </span>{" "}
                  written on a piece of paper inside the package.
                </p>
              </div>
            </div>

            {/* Expiry Reminder */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  This quote is valid for{" "}
                  <span className="font-medium text-foreground">14 days</span>{" "}
                  from acceptance. Please ship your device within this period.
                </p>
              </div>
            </div>

            {/* New Quote Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/")}
            >
              Trade in another device
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
