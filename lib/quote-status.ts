/**
 * Trade-in quote statuses (single-device `quotes` collection) and labels.
 * Client-safe: no server imports. Transitions live in lib/quote-transitions.ts.
 */

export const QUOTE_STATUSES = [
  "quoted",
  "accepted",
  "shipped",
  "received",
  "on_hold",
  "revised",
  "inspected",
  "paid",
  "returning",
  "returned",
  "expired",
  "cancelled",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  quoted: "Quoted",
  accepted: "Accepted",
  shipped: "Shipped",
  received: "Received",
  on_hold: "On Hold",
  revised: "Revised",
  inspected: "Inspected",
  paid: "Paid",
  returning: "Returning",
  returned: "Returned",
  expired: "Expired",
  cancelled: "Cancelled",
};

/** Statuses with no outgoing transitions (expired can still be received). */
export const TERMINAL_QUOTE_STATUSES: readonly QuoteStatus[] = [
  "paid",
  "returned",
  "cancelled",
];

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return (
    typeof value === "string" &&
    (QUOTE_STATUSES as readonly string[]).includes(value)
  );
}

export const CANCEL_REASONS = [
  "not_genuine",
  "customer_request",
  "duplicate",
  "lost_in_transit",
  "surrendered",
  "other",
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  not_genuine: "Not genuine (bot, fake or test details)",
  customer_request: "Customer asked to cancel",
  duplicate: "Duplicate acceptance",
  lost_in_transit: "Lost in transit",
  surrendered: "Surrendered to authorities",
  other: "Other",
};

export type QuoteActor = "customer" | "partner" | "apiKey" | "admin" | "system";

/** Display form of the sequential trade-in reference. */
export function formatTradeInRef(n: number): string {
  return `TI-${n}`;
}
