/**
 * v1 API views of a single quote (app/api/v1/quotes). Client-safe.
 */

import { payableAmount } from "@/lib/quote-money";

/**
 * Status as the v1 API reports it. A Mode C trade-in ends as `paid`
 * internally (complete for RHEX) but RHEX pays nobody directly, so partners
 * see `completed`: the partner refunds the customer (docs/partners/OPPO.md).
 */
export function v1QuoteStatus(q: Record<string, unknown>): unknown {
  return q.partnerMode === "C" && q.status === "paid" ? "completed" : q.status;
}

/** Revised offer in the quote's display currency, at its locked FX rate. */
export function v1RevisedPrice(q: Record<string, unknown>): number | null {
  if (q.revisedPriceNZD === undefined || q.revisedPriceNZD === null) return null;
  return payableAmount(q).amount;
}
