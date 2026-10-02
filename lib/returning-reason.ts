/**
 * Why a trade-in device is going back to the customer, for the Mode C
 * returning email and quote page. Client-safe: no server imports.
 *
 * Never shows the quote's `returnReason`, which is an admin's note.
 */

/** The customer's answer, no answer, or RHEX's. */
export type ReturningReason = "declined" | "expired" | "rejected";

export function returningReason(quote: {
  revisionAutoExpired?: unknown;
  revisionRejectedAt?: unknown;
}): ReturningReason {
  if (quote.revisionAutoExpired === true) return "expired";
  if (quote.revisionRejectedAt) return "declined";
  return "rejected";
}
