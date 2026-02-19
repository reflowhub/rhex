"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gtagEvent } from "@/lib/gtag";

interface FeedbackData {
  submitted: boolean;
  customerName?: string;
  deviceName?: string;
  rating?: number;
  comment?: string;
}

export default function FeedbackPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = use(params);

  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/feedback/${quoteId}`);
        if (res.ok) {
          const d = await res.json();
          setData(d);
          if (d.submitted) {
            setSubmitted(true);
            setRating(d.rating ?? 0);
          }
        } else {
          setError("This feedback link is no longer valid.");
        }
      } catch {
        setError("Failed to load. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [quoteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/feedback/${quoteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });

      if (res.ok) {
        setSubmitted(true);
        gtagEvent("feedback_submitted", { quote_id: quoteId, rating });
      } else if (res.status === 409) {
        setSubmitted(true);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to submit feedback.");
      }
    } catch {
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const googlePlaceId = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-4">
          <Link href="/sell" className="flex items-center gap-2">
            <Image
              src="/logo-rhex.svg"
              alt="rhex"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="text-sm font-bold tracking-tight">
              rhex trade-in
            </span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Loading */}
        {loading && (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        )}

        {/* Error (no data) */}
        {!loading && error && !data && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}

        {/* Success / Already Submitted */}
        {!loading && submitted && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h1 className="text-xl font-semibold mb-2">
                Thanks for your feedback!
              </h1>
              <div className="flex justify-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-6 w-6 ${
                      s <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
              <p className="text-muted-foreground">
                You're entered in this month's raffle. We'll email you if you
                win!
              </p>
            </div>

            {/* Separate Google Review ask */}
            {googlePlaceId && (
              <div className="rounded-xl border bg-card p-6 shadow-sm text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  One more thing...
                </p>
                <p className="font-semibold mb-3">
                  Help others find us on Google!
                </p>
                <a
                  href={`https://search.google.com/local/writereview?placeid=${googlePlaceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 text-sm transition-colors"
                  onClick={() =>
                    gtagEvent("google_review_click", {
                      quote_id: quoteId,
                      source: "feedback_page",
                    })
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-current"
                  >
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Leave a Google Review
                </a>
              </div>
            )}
          </div>
        )}

        {/* Feedback Form */}
        {!loading && !submitted && data && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h1 className="text-xl font-semibold mb-1">
                How was your trade-in experience?
              </h1>
              {data.deviceName && (
                <p className="text-sm text-muted-foreground mb-1">
                  {data.deviceName}
                </p>
              )}
              <p className="text-sm text-muted-foreground mb-6">
                Rate your experience and enter our monthly raffle!
              </p>

              {/* Star Rating */}
              <div className="mb-6">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHoveredRating(s)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-10 w-10 transition-colors ${
                          s <= (hoveredRating || rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating === 0 && (
                  <p className="text-center text-sm text-muted-foreground mt-2">
                    Tap a star to rate
                  </p>
                )}
              </div>

              {/* Comment */}
              <div className="mb-4">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us more (optional)..."
                  maxLength={1000}
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={rating === 0 || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit & Enter Raffle"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground mt-3">
                One entry per trade-in. Winners drawn monthly.
              </p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
