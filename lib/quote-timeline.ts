/**
 * Customer-facing trade-in timeline, built from a quote's `statusHistory`.
 * Client-safe: no server imports.
 *
 * The public quote endpoint returns only `{step, at}` pairs: never the actor,
 * actor ID or reason, which can hold internal notes (e.g. why a device is on
 * hold).
 */

import { isQuoteStatus, type QuoteStatus } from "@/lib/quote-status";
import { serializeTimestamp } from "@/lib/serialize";

export type TimelineStep = QuoteStatus | "label_sent";

export interface TimelineEntry {
  step: TimelineStep;
  /** ISO timestamp */
  at: string;
}

/** Timestamp fields for quotes written before `statusHistory` existed. */
const LEGACY_TIMESTAMP_FIELDS: [QuoteStatus, string][] = [
  ["quoted", "createdAt"],
  ["accepted", "acceptedAt"],
  ["shipped", "shippedAt"],
  ["received", "receivedAt"],
  ["revised", "revisedAt"],
  ["inspected", "inspectedAt"],
  ["paid", "paidAt"],
  ["returning", "returningAt"],
  ["returned", "returnedAt"],
  ["expired", "expiredAt"],
  ["cancelled", "cancelledAt"],
];

/**
 * One entry per status the quote has reached, oldest first, plus the label
 * being sent. Each status appears once, at the first time it was reached, so
 * a release from hold (`on_hold → received`) doesn't repeat "received".
 */
export function customerTimeline(data: Record<string, unknown>): TimelineEntry[] {
  const firstAt = new Map<TimelineStep, string>();
  const add = (step: TimelineStep, at: unknown) => {
    const iso = serializeTimestamp(at);
    if (iso && !firstAt.has(step)) firstAt.set(step, iso);
  };

  add("quoted", data.createdAt);

  const history = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  for (const entry of history) {
    if (entry && typeof entry === "object" && isQuoteStatus(entry.to)) {
      add(entry.to, entry.at);
    }
  }
  if (history.length === 0) {
    for (const [status, field] of LEGACY_TIMESTAMP_FIELDS) add(status, data[field]);
  }

  add("label_sent", data.labelSentAt);

  return Array.from(firstAt, ([step, at]) => ({ step, at })).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
}

export const TIMELINE_STEP_LABELS: Record<TimelineStep, string> = {
  quoted: "Quote created",
  accepted: "Quote accepted",
  label_sent: "Shipping label sent",
  shipped: "Posted",
  received: "Device received",
  on_hold: "Under review",
  revised: "Revised offer sent",
  inspected: "Inspected and confirmed",
  paid: "Payment sent",
  returning: "Return started",
  returned: "Device returned",
  expired: "Expired",
  cancelled: "Cancelled",
};
