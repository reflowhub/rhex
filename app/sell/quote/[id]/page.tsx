"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Search,
  XCircle,
  History,
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
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { originalAmount, payableAmount } from "@/lib/quote-money";
import { formatTimeLeft } from "@/lib/quote-validity";
import { formatCustomerDate } from "@/lib/label-deadlines";
import AuAddressFields from "@/components/au-address-fields";
import {
  EMPTY_AU_ADDRESS,
  isAuAddressComplete,
  type AuAddressInput,
} from "@/lib/au-address";
import { TIMELINE_STEP_LABELS, type TimelineEntry } from "@/lib/quote-timeline";
import { returningReason } from "@/lib/returning-reason";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-shop",
});
import { gtagEvent, gtagConversion } from "@/lib/gtag";
import { fbPixelEvent } from "@/lib/fbpixel";
import { SELL_GRADE_LABELS as GRADE_LABELS, GRADE_COLORS } from "@/lib/grades";
import {
  TradeInLabelCard,
  TradeInShippingInstructions,
} from "@/components/trade-in-shipping";

import { AlertTriangle } from "lucide-react";

interface QuoteData {
  id: string;
  deviceId: string;
  grade: string;
  quotePriceNZD: number;
  quotePriceDisplay?: number;
  displayCurrency: string;
  fxRate?: number;
  status: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  tradeInRef?: string;
  trackingNumber?: string;
  hasLabel?: boolean;
  /** Mode C: the partner made the label and emailed it (no download here) */
  labelFrom?: string;
  labelSentAt?: string;
  postByAt?: string;
  shippedAt?: string;
  receivedAt?: string;
  paidAt?: string;
  timeline?: TimelineEntry[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentMethod?: string;
  /** Masked, e.g. "•••• 123" */
  payIdPhone?: string;
  /** Masked, e.g. "•••• 123" */
  bankAccountNumber?: string;
  imei?: string;
  device?: {
    id: string;
    make: string;
    model: string;
    storage: string;
  };
  inspectionGrade?: string;
  revisedPriceNZD?: number;
  revisedPriceDisplay?: number;
  revisedDeviceId?: string;
  revisedDeviceMake?: string;
  revisedDeviceModel?: string;
  revisedDeviceStorage?: string;
  revisedAt?: string;
  revisionExpiresAt?: string;
  revisionRejectedAt?: string;
  revisionAutoExpired?: boolean;
  /** Mode C only: the partner's brand. The partner makes the trade-in payment. */
  partner?: PartnerBrand;
}

interface PartnerBrand {
  mode: "C";
  name: string;
  logoUrl: string | null;
  supportEmail: string;
  supportPhone: string | null;
}

interface CompetitorOffer {
  name: string;
  price: number;
  grade: string;
}

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
  const [copied, setCopied] = useState(false);
  const [requoting, setRequoting] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorOffer[]>([]);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [payIdPhone, setPayIdPhone] = useState("");
  const [bankBSB, setBankBSB] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [shippingAddress, setShippingAddress] = useState<AuAddressInput>(EMPTY_AU_ADDRESS);
  const [imeiInput, setImeiInput] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Fetch quote
  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch(`/api/quote/${id}`);
        if (res.ok) {
          const data = await res.json();
          setQuote(data);
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

  // Fetch competitor prices (AUD quotes only, while the quote is open)
  useEffect(() => {
    if (
      !quote ||
      quote.status !== "quoted" ||
      quote.partner ||
      quote.displayCurrency !== "AUD" ||
      !quote.device
    ) {
      setCompetitors([]);
      return;
    }
    const rhexPrice = quote.quotePriceDisplay ?? quote.quotePriceNZD;
    const params = new URLSearchParams({
      make: quote.device.make,
      model: quote.device.model,
      storage: quote.device.storage,
      grade: quote.grade,
      rhexPrice: String(rhexPrice),
    });
    fetch(`/api/competitor-prices?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.competitors?.length) setCompetitors(data.competitors);
      })
      .catch(() => {});
  }, [quote]);

  const handleAcceptQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    gtagEvent("trade_in_form_submission", {
      quote_id: id,
      device_id: quote?.deviceId,
      grade: quote?.grade,
      currency: quote?.displayCurrency,
      payment_method: paymentMethod,
    });

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

    if (imeiInput && /^\d{15}$/.test(imeiInput) && !quote?.imei) {
      body.imei = imeiInput;
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
        setShowAcceptForm(false);
        const conversionValue = data.quotePriceDisplay ?? data.quotePriceNZD;
        const conversionCurrency = data.displayCurrency;
        gtagEvent("trade_in_conversion", {
          quote_id: id,
          device_id: data.deviceId,
          grade: data.grade,
          value: conversionValue,
          currency: conversionCurrency,
          payment_method: paymentMethod,
        });
        gtagConversion(conversionValue, conversionCurrency);
        fbPixelEvent("Lead", {
          value: conversionValue,
          currency: conversionCurrency,
        });
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

  const handleRequote = async () => {
    if (!quote) return;
    setRequoting(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: quote.deviceId,
          grade: quote.grade,
          displayCurrency: quote.displayCurrency,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/sell/quote/${data.id}`);
      } else {
        setError("Failed to create new quote. Please try again.");
      }
    } catch {
      setError("Failed to create new quote. Please try again.");
    } finally {
      setRequoting(false);
    }
  };

  const handleMarkPosted = async () => {
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/quote/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_shipped" }),
      });
      const data = await res.json();
      if (res.ok) {
        setQuote(data);
      } else {
        setError(data.error || "Failed to update your trade-in");
      }
    } catch {
      setError("Failed to update your trade-in. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleCopyRef = () => {
    if (quote?.id) {
      navigator.clipboard.writeText(quote.tradeInRef ?? quote.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevisionResponse = async (action: "accept_revision" | "reject_revision") => {
    setRevisionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quote/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuote(data);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to respond to revision");
      }
    } catch {
      setError("Failed to respond. Please try again.");
    } finally {
      setRevisionLoading(false);
    }
  };

  // Mode C: co-branded; the partner accepts at checkout and makes the
  // trade-in payment, so no accept form, payout details or links to /sell
  const partner = quote?.partner ?? null;

  // Only an open quote can be accepted
  const isQuoted = quote?.status === "quoted";

  // An unaccepted quote past expiresAt, whether or not the status has
  // caught up yet (the quote-expiry cron runs hourly)
  const isExpired =
    (quote?.status === "expired" && !quote.acceptedAt) ||
    (isQuoted && !!quote?.expiresAt && new Date(quote.expiresAt) < new Date());
  // An accepted quote that was never posted (postByAt + 30 days)
  const isClosedUnposted = quote?.status === "expired" && !!quote.acceptedAt;
  // Accepted and still waiting for (or showing) the shipping label
  const isAwaitingDevice =
    quote?.status === "accepted" || quote?.status === "shipped";
  // The customer has accepted at some point: show the reference and timeline
  const hasAccepted = !!quote?.acceptedAt && quote.status !== "quoted";

  // Loading state
  if (loading) {
    return (
      <main
        className={cn("min-h-screen bg-background", inter.variable)}
        style={{
          fontFamily:
            "var(--font-shop), 'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/sell")}>
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
      <main
        className={cn("min-h-screen bg-background", inter.variable)}
        style={{
          fontFamily:
            "var(--font-shop), 'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/sell")}>
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
          <Button className="mt-6" onClick={() => router.push("/sell")}>
            Get a New Quote
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main
      className={cn("min-h-screen bg-background", inter.variable)}
      style={{
        fontFamily:
          "var(--font-shop), 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Header */}
      {partner ? (
        <PartnerHeader partner={partner} />
      ) : (
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/sell")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Link href="/sell" className="flex items-center gap-2">
              <Image
                src="/logo-rhex.svg"
                alt="rhex"
                width={24}
                height={24}
                className="h-6 w-6"
              />
              <span className="text-sm font-bold tracking-tight">rhex trade-in</span>
            </Link>
          </div>
        </header>
      )}

      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Accepted / posted: waiting for the device */}
        {isAwaitingDevice && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-800">
                  {quote.status === "shipped" ? "On Its Way" : "Quote Accepted"}
                </p>
                <p className="text-sm text-green-700">
                  {quote.status === "shipped"
                    ? "Thanks for posting your device. We'll let you know when it arrives."
                    : quote.labelFrom
                    ? `${quote.labelFrom} has emailed you a prepaid shipping label.`
                    : quote.hasLabel
                    ? "Your prepaid shipping label is ready below."
                    : quote.partner
                    ? "Your trade-in has been confirmed. You'll receive your prepaid shipping label by email shortly."
                    : "Your quote has been confirmed. We'll email your prepaid shipping label shortly."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Received — inspection pending */}
        {quote.status === "received" && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-800">Device Received</p>
                <p className="text-sm text-blue-700">
                  {quote.receivedAt
                    ? `Your device arrived on ${formatCustomerDate(quote.receivedAt)}. `
                    : "Your device has arrived. "}
                  We&apos;ll inspect it and email you the result.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* On hold — shown as "Under review"; the reason is never shown */}
        {quote.status === "on_hold" && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-800">Under Review</p>
                <p className="text-sm text-blue-700">
                  We&apos;re completing some routine checks on your device
                  before we can finish your trade-in. We&apos;ll contact you if
                  we need anything from you.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Revised Quote — Accept / Reject */}
        {quote.status === "revised" && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-800">
                Revised Quote
              </h3>
            </div>
            <p className="text-sm text-amber-700 mb-4">
              After inspecting your device, we found it differs from the
              original quote. Please review the changes below.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-white/80 p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  Original
                </p>
                <p className="font-medium text-sm">
                  {quote.device?.make} {quote.device?.model}
                </p>
                <p className="text-xs text-muted-foreground">
                  Grade {quote.grade}
                </p>
                <p className="text-lg font-bold mt-1">
                  ${originalAmount(quote).amount.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-white/80 p-3 border-2 border-amber-300">
                <p className="text-xs text-muted-foreground mb-1">
                  Revised
                </p>
                <p className="font-medium text-sm">
                  {quote.revisedDeviceId
                    ? `${quote.revisedDeviceMake} ${quote.revisedDeviceModel}`
                    : `${quote.device?.make} ${quote.device?.model}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Grade {quote.inspectionGrade}
                </p>
                <p className="text-lg font-bold mt-1">
                  ${payableAmount(quote).amount.toFixed(2)}
                </p>
              </div>
            </div>

            {partner ? (
              <p className="text-xs text-amber-600 mb-4">
                If you accept, {partner.name} will make a trade-in payment of $
                {payableAmount(quote).amount.toFixed(2)}{" "}
                {payableAmount(quote).currency} to the payment method you used
                for your {partner.name} order once your trade-in is approved.
                If you decline
                {quote.revisionExpiresAt
                  ? `, or we don't hear from you by ${formatCustomerDate(quote.revisionExpiresAt)}`
                  : ""}
                , we&apos;ll post your device back to you at no cost and{" "}
                {partner.name} won&apos;t make a trade-in payment.
              </p>
            ) : (
              quote.revisionExpiresAt && (
                <p className="text-xs text-amber-600 mb-4">
                  Please respond by {formatCustomerDate(quote.revisionExpiresAt)}
                  . If no response, your device will be returned.
                </p>
              )
            )}

            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() =>
                  handleRevisionResponse("accept_revision")
                }
                disabled={revisionLoading}
              >
                {revisionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {partner ? "Accept revised offer" : "Accept Revised Offer"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  handleRevisionResponse("reject_revision")
                }
                disabled={revisionLoading}
              >
                {partner ? "Decline and return my device" : "Reject & Return Device"}
              </Button>
            </div>
          </div>
        )}

        {/* Returning — device being sent back */}
        {quote.status === "returning" && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-800">
                  Device Being Returned
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {partner ? (
                    <>
                      {
                        {
                          declined:
                            "You declined the revised offer, so we're posting your device back to you at no cost.",
                          expired:
                            "We didn't hear back about the revised offer, so we're posting your device back to you at no cost.",
                          rejected:
                            "We're unable to accept your device for trade-in, so we're posting it back to you at no cost.",
                        }[returningReason(quote)]
                      }{" "}
                      This trade-in won&apos;t go ahead, and {partner.name}{" "}
                      won&apos;t make a trade-in payment for it. We&apos;ll
                      email you the tracking number once it&apos;s on its way.
                    </>
                  ) : (
                    <>
                      Your device is being prepared for return. We will send
                      it back to the shipping address on file.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Expired after acceptance — never posted */}
        {isClosedUnposted && (
          <div className="mb-6 rounded-xl border bg-muted p-4">
            <p className="font-semibold">Trade-In Closed</p>
            <p className="text-sm text-muted-foreground mt-1">
              We didn&apos;t receive your device in time, so this trade-in has
              been closed and its shipping label cancelled. Please don&apos;t
              use the label. If you&apos;ve already posted your device, contact
              us{partner && <> at <SupportEmailLink partner={partner} /></>}{" "}
              with your postage receipt.
            </p>
          </div>
        )}

        {/* Returned — terminal */}
        {quote.status === "returned" && (
          <div className="mb-6 rounded-xl border bg-muted p-4">
            <p className="font-semibold">Device Returned</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your device has been returned. This trade-in is now closed.
            </p>
          </div>
        )}

        {/* Cancelled */}
        {quote.status === "cancelled" && (
          <div className="mb-6 rounded-xl border bg-muted p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-semibold">Trade-In Cancelled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This trade-in has been cancelled. If you think this is a
                  mistake, please contact us
                  {partner && <> at <SupportEmailLink partner={partner} /></>}.
                </p>
              </div>
            </div>
            {!partner && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => router.push("/sell")}
              >
                Get a New Quote
              </Button>
            )}
          </div>
        )}

        {/* Mode C paid — terminal: approved, the partner pays. Wording
            agreed in docs/partners/OPPO.md (2b); never shows bonus amounts. */}
        {quote.status === "paid" && partner && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="font-semibold text-green-800">Approved</p>
                <p className="text-sm text-green-700">
                  Your trade-in value of ${payableAmount(quote).amount.toFixed(2)}{" "}
                  {payableAmount(quote).currency} is approved.{" "}
                  {partner.name} will make a trade-in payment of $
                  {payableAmount(quote).amount.toFixed(2)}{" "}
                  {payableAmount(quote).currency} to the payment method you
                  used for your {partner.name} order. Any {partner.name} bonus credit is applied by{" "}
                  {partner.name} under its promotion terms.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Paid — terminal */}
        {quote.status === "paid" && !partner && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="font-semibold text-green-800">Payment Sent</p>
                <p className="text-sm text-green-700">
                  We&apos;ve paid ${payableAmount(quote).amount.toFixed(2)}{" "}
                  {payableAmount(quote).currency}
                  {quote.paymentMethod === "payid" && quote.payIdPhone
                    ? ` to your PayID ${quote.payIdPhone}`
                    : quote.paymentMethod === "bank_transfer" && quote.bankAccountNumber
                    ? ` to your bank account ${quote.bankAccountNumber}`
                    : ""}
                  {quote.paidAt ? ` on ${formatCustomerDate(quote.paidAt)}` : ""}.
                  Thanks for trading in with us.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Processing status (inspected, waiting for payment) */}
        {quote.status === "inspected" && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="font-semibold text-green-800">
                  Quote Confirmed
                </p>
                <p className="text-sm text-green-700">
                  {partner
                    ? "Your trade-in has been inspected and confirmed. We'll email you once it's approved."
                    : "Your trade-in has been inspected and confirmed. Payment will be processed shortly."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quote Result Card (the last block has no bottom margin) */}
        <div className="rounded-xl border bg-card p-6 shadow-sm [&>*:last-child]:mb-0">
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
                {quote.imei && (
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    IMEI: {quote.imei}
                  </p>
                )}
              </div>
            </div>
          )}


          {/* Price: the final amount once a revised offer is accepted */}
          {(() => {
            const payable = payableAmount(quote);
            const isFinal =
              payable.revised &&
              (quote.status === "inspected" || quote.status === "paid");
            const shown = isFinal ? payable : originalAmount(quote);
            return (
              <div className="mb-6 rounded-lg bg-primary/5 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {partner
                    ? isFinal
                      ? "Final Trade-In Value"
                      : "Trade-In Value"
                    : isFinal
                      ? "Final Price"
                      : "Your Quote"}
                </p>
                <p className="mt-1 text-4xl font-bold text-primary">
                  ${shown.amount.toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {shown.currency}
                  {isFinal && (
                    <span className="ml-2 line-through">
                      ${originalAmount(quote).amount.toFixed(2)}
                    </span>
                  )}
                </p>
              </div>
            );
          })()}

          {/* Competitor Comparison: only for an open quote. After a revision
              the original price would overstate the difference. */}
          {isQuoted && !isExpired && competitors.length > 0 && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50/50 p-4">
              <p className="text-sm font-medium text-green-800 mb-3">
                Compare with other trade-in programs
              </p>
              <div className="space-y-2">
                {competitors.map((c) => {
                  const rhexPrice = quote.quotePriceDisplay ?? quote.quotePriceNZD;
                  const savings = rhexPrice - c.price;
                  return (
                    <div
                      key={c.name}
                      className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{c.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          ${c.price.toFixed(2)}
                        </span>
                        <span className="font-medium text-green-700">
                          +${savings.toFixed(2)} more with us
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode C open quote: the partner accepts it at checkout */}
          {partner && isQuoted && !isExpired && (
            <div className="mb-6 rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                This trade-in is confirmed when you complete your order with{" "}
                {partner.name}.
              </p>
            </div>
          )}

          {/* Expiry Notice */}
          {!partner && isQuoted && !isExpired && (
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

          {partner && isExpired && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm text-destructive font-medium">
                This quote expired before your order with {partner.name} was
                completed.
              </p>
            </div>
          )}

          {!partner && isExpired && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm text-destructive font-medium">
                This quote has expired. Prices may have changed.
              </p>
              <Button
                onClick={handleRequote}
                disabled={requoting}
                size="sm"
                className="mt-3"
              >
                {requoting ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Get New Quote"
                )}
              </Button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Accept Button (Mode C partners accept through the API) */}
          {!partner && isQuoted && !isExpired && !showAcceptForm && (
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
          {!partner && showAcceptForm && isQuoted && (
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
                <Label htmlFor="phone">Mobile Number</Label>
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

              {!quote.imei && (
                <div>
                  <Label htmlFor="imei">IMEI (optional)</Label>
                  <Input
                    id="imei"
                    value={imeiInput}
                    onChange={(e) => setImeiInput(e.target.value.replace(/\D/g, "").slice(0, 15))}
                    placeholder="Enter 15-digit IMEI"
                    className="mt-1"
                    maxLength={15}
                    inputMode="numeric"
                  />
                  {imeiInput && imeiInput.length !== 15 && (
                    <p className="mt-1 text-xs text-amber-600">
                      IMEI must be 15 digits
                    </p>
                  )}
                </div>
              )}

              <AuAddressFields
                idPrefix="address"
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

              {/* PayID Fields */}
              {paymentMethod === "payid" && (
                <div className="space-y-2">
                  <Label htmlFor="payid-phone">PayID Mobile Number</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={payIdPhone === customerPhone && customerPhone !== ""}
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
                    id="payid-phone"
                    type="tel"
                    value={payIdPhone}
                    onChange={(e) => setPayIdPhone(e.target.value)}
                    placeholder="04XX XXX XXX"
                    required
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
                  <Link
                    href="/terms/trade-in"
                    target="_blank"
                    className="underline underline-offset-4 hover:text-primary"
                  >
                    Trade-In Terms &amp; Conditions
                  </Link>
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

        {/* Post-Acceptance Details */}
        {hasAccepted && (
          <div className="mt-6 space-y-4">
            {/* Quote Reference */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">
                  {quote.tradeInRef ? "Trade-In Reference" : "Quote Reference"}
                </h3>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                <code className="flex-1 text-sm font-mono break-all">
                  {quote.tradeInRef ?? quote.id}
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

            {isAwaitingDevice && quote.hasLabel && (
              <TradeInLabelCard
                quoteId={quote.id}
                tradeInRef={quote.tradeInRef}
                trackingNumber={quote.trackingNumber}
                postByAt={quote.postByAt}
                labelFrom={quote.labelFrom}
                shippedAt={quote.status === "shipped" ? quote.shippedAt : undefined}
                posting={posting}
                onMarkPosted={handleMarkPosted}
              />
            )}
            {isAwaitingDevice && !quote.hasLabel && (
              <TradeInShippingInstructions
                quoteId={quote.id}
                tradeInRef={quote.tradeInRef}
                retailer={!!quote.partner}
              />
            )}

            {/* Timeline (statusHistory, as {step, at} only) */}
            {quote.timeline && quote.timeline.length > 1 && (
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Timeline</h3>
                </div>
                <ol className="space-y-3">
                  {quote.timeline.map((entry, idx, all) => (
                    <li key={entry.step} className="flex items-start gap-3 text-sm">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          idx === all.length - 1 ? "bg-primary" : "bg-muted-foreground/40"
                        )}
                      />
                      <div className="flex flex-1 items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            idx === all.length - 1
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {partner && entry.step === "paid"
                            ? "Approved"
                            : TIMELINE_STEP_LABELS[entry.step] ?? entry.step}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatCustomerDate(entry.at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Google Review Prompt */}
            {!partner &&
              process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID &&
              (isAwaitingDevice || quote.status === "paid") && (
              <div className="rounded-xl border bg-card p-6 shadow-sm text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Had a good experience?
                </p>
                <p className="font-semibold mb-3">
                  We&apos;d love your feedback on Google!
                </p>
                <a
                  href={`https://search.google.com/local/writereview?placeid=${process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 text-sm transition-colors"
                  onClick={() =>
                    gtagEvent("google_review_click", { quote_id: id })
                  }
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Leave a Google Review
                </a>
              </div>
            )}

            {/* New Quote Button */}
            {!partner && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/sell")}
              >
                Trade in another device
              </Button>
            )}
          </div>
        )}

        {partner && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Questions? Email <SupportEmailLink partner={partner} />
            {partner.supportPhone && (
              <>
                {" "}or call{" "}
                <a
                  href={`tel:${partner.supportPhone.replace(/[^+0-9]/g, "")}`}
                  className="underline underline-offset-4 hover:text-primary"
                >
                  {partner.supportPhone}
                </a>
              </>
            )}
            .
          </p>
        )}
      </div>
    </main>
  );
}

/** Mode C header: the partner's logo (or name), no links back to /sell. */
function PartnerHeader({ partner }: { partner: PartnerBrand }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        {partner.logoUrl ? (
          // Partner logos can be on any https host, outside next/image's remotePatterns
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={partner.logoUrl}
            alt={partner.name}
            className="h-7 w-auto max-w-[160px] object-contain"
          />
        ) : (
          <span className="text-sm font-bold tracking-tight">{partner.name}</span>
        )}
        <span className="text-xs text-muted-foreground">
          Trade-in powered by Reflow Hub
        </span>
      </div>
    </header>
  );
}

function SupportEmailLink({ partner }: { partner: PartnerBrand }) {
  return (
    <a
      href={`mailto:${partner.supportEmail}`}
      className="underline underline-offset-4 hover:text-primary"
    >
      {partner.supportEmail}
    </a>
  );
}
