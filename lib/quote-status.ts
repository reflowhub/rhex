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

/**
 * Labels shown to customers and partners. `on_hold` covers ownership,
 * blacklist and fraud checks (terms §3), so it never says why.
 */
export const PUBLIC_QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  ...QUOTE_STATUS_LABELS,
  on_hold: "Under Review",
};

/** Statuses with no outgoing transitions (expired can still be received). */
export const TERMINAL_QUOTE_STATUSES: readonly QuoteStatus[] = [
  "paid",
  "returned",
  "cancelled",
];

/** Quotes still in progress: not yet paid, returned, cancelled or expired. */
export const OPEN_QUOTE_STATUSES: readonly QuoteStatus[] = QUOTE_STATUSES.filter(
  (s) => s !== "expired" && !TERMINAL_QUOTE_STATUSES.includes(s)
);

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return (
    typeof value === "string" &&
    (QUOTE_STATUSES as readonly string[]).includes(value)
  );
}

/** Label for a stored status; unknown values (e.g. bulk statuses) pass through. */
export function quoteStatusLabel(status: unknown, audience: "admin" | "public" = "admin"): string {
  if (!isQuoteStatus(status)) return typeof status === "string" ? status : "";
  return audience === "public"
    ? PUBLIC_QUOTE_STATUS_LABELS[status]
    : QUOTE_STATUS_LABELS[status];
}

export interface QuoteStatusBadge {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
}

const QUOTE_STATUS_BADGES: Record<QuoteStatus, QuoteStatusBadge> = {
  quoted: { variant: "default" },
  accepted: { variant: "secondary" },
  shipped: { variant: "outline" },
  received: { variant: "secondary" },
  on_hold: {
    variant: "outline",
    className: "border-orange-300 text-orange-700",
  },
  revised: {
    variant: "default",
    className: "border-transparent bg-amber-500 text-white hover:bg-amber-500/80",
  },
  inspected: { variant: "default" },
  paid: {
    variant: "default",
    className: "border-transparent bg-green-600 text-white hover:bg-green-600/80",
  },
  returning: {
    variant: "outline",
    className: "border-amber-300 text-amber-700",
  },
  returned: { variant: "secondary" },
  expired: { variant: "outline", className: "text-muted-foreground" },
  cancelled: { variant: "destructive" },
};

/** Badge styling for a quote status (outline for anything unknown). */
export function quoteStatusBadge(status: unknown): QuoteStatusBadge {
  return isQuoteStatus(status) ? QUOTE_STATUS_BADGES[status] : { variant: "outline" };
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

/** Bot, scraping, fake or test acceptances: left out of analytics and funnels. */
export function isNotGenuine(q: { status?: unknown; cancelReason?: unknown }): boolean {
  return q.status === "cancelled" && q.cancelReason === "not_genuine";
}

export const FUNNEL_STAGES = [
  "quoted",
  "accepted",
  "shipped",
  "received",
  "inspected",
  "paid",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/**
 * The furthest funnel stage a quote reached, or null for cancelled quotes
 * (counted separately) and unknown statuses. Side states map back onto the
 * main path: a revised, held or returned device was received (or inspected).
 */
export function funnelStage(q: {
  status?: unknown;
  acceptedAt?: unknown;
  inspectedAt?: unknown;
}): FunnelStage | null {
  if (!isQuoteStatus(q.status)) return null;
  switch (q.status) {
    case "cancelled":
      return null;
    case "expired":
      // Reached "quoted", or "accepted" if it was never posted
      return q.acceptedAt ? "accepted" : "quoted";
    case "revised":
      return "received";
    case "on_hold":
    case "returning":
    case "returned":
      return q.inspectedAt ? "inspected" : "received";
    default:
      return q.status;
  }
}

export type QuoteActor = "customer" | "partner" | "apiKey" | "admin" | "system";

/** Display form of the sequential trade-in reference. */
export function formatTradeInRef(n: number): string {
  return `TI-${n}`;
}
