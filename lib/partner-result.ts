/**
 * Mode C trade-in results: the final outcome RHEX sends a partner (e.g.
 * OPPO) so it knows whether to refund the customer. Client-safe and pure; signing is in lib/partner-result-signing.ts and
 * delivery (queue, retries) in lib/partner-notifications.ts.
 *
 * See docs/partners/oppo-trade-in-result-api.md and docs/partners/OPPO.md.
 */

import { payableAmount } from "@/lib/quote-money";
import type { QuoteStatus } from "@/lib/quote-status";

/** Body of the result PUT, field names as in the partner's spec. */
export interface PartnerResultBody {
  /** Final trade-in value in the quote's currency (AUD for OPPO) */
  approvedQuotePrice: number;
  /** Final RHEX grade */
  acceptGrading: string;
  /** Whether the trade-in went ahead (true → the partner refunds the customer) */
  accepted: boolean;
}

/** Grades the result API accepts. */
export const RESULT_GRADES = ["A", "B", "C", "D", "E"] as const;

export function isResultGrade(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (RESULT_GRADES as readonly string[]).includes(value)
  );
}

/**
 * The result a Mode C transition sends, or null if it isn't a final outcome.
 * `q` is the quote with this transition's fields already applied.
 *
 * - inspected → paid: approved. A matched device (no revised price) sends the
 *   original price and grade; an accepted re-quote sends the revised price
 *   and the inspection grade.
 * - → returning, on_hold → cancelled: not going ahead (customer declined or
 *   ignored a re-quote, RHEX rejected the device, or it was surrendered).
 *   Sends the last offered price and grade with accepted: false.
 *
 * Cancellations before the device arrives and unshipped expiry send nothing
 * (never-arrived handling is behind config, docs/partners/OPPO.md).
 */
export function partnerResultFor(
  q: Record<string, unknown>,
  from: QuoteStatus,
  to: QuoteStatus
): PartnerResultBody | null {
  const approved = to === "paid";
  const declined =
    to === "returning" || (from === "on_hold" && to === "cancelled");
  if (!approved && !declined) return null;

  const payable = payableAmount(q);
  const revised = payable.revised;
  const grade = String(
    (revised || declined ? q.inspectionGrade : null) ?? q.grade ?? ""
  ).toUpperCase();

  return {
    approvedQuotePrice: Math.round(payable.amount * 100) / 100,
    acceptGrading: grade,
    accepted: approved,
  };
}

/** The partner's result URL for a quote, from a template with `{quoteId}`. */
export function partnerResultUrl(template: string, quoteId: string): string {
  return template.replace("{quoteId}", encodeURIComponent(quoteId));
}

// ---------------------------------------------------------------------------
// Delivery outcome
// ---------------------------------------------------------------------------

/** Waits before each retry: 1m, 5m, 15m, 1h, 3h, 6h, 12h, then 24h. */
export const RETRY_DELAYS_MS = [
  1, 5, 15, 60, 3 * 60, 6 * 60, 12 * 60, 24 * 60,
].map((m) => m * 60 * 1000);

/** Attempts before a notification is marked failed (first try + retries). */
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export type DeliveryOutcome = "sent" | "retry" | "failed";

/**
 * What to do after an attempt. 2xx is done. 400/401/404 (and other 4xx)
 * mean the request itself is wrong, so retrying won't help. 5xx, 429 and
 * network errors (status null) are retried until attempts run out.
 */
export function classifyDelivery(
  status: number | null,
  attempts: number
): DeliveryOutcome {
  if (status !== null && status >= 200 && status < 300) return "sent";
  const retryable = status === null || status === 429 || status >= 500;
  if (!retryable) return "failed";
  return attempts >= MAX_ATTEMPTS ? "failed" : "retry";
}

/** Delay before the next attempt, after `attempts` attempts so far. */
export function retryDelayMs(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempts, 1), RETRY_DELAYS_MS.length) - 1];
}
