/**
 * Match a scanned or typed value against a trade-in quote on the receive
 * screen. Pure, so it can be tested without Firestore.
 *
 * AusPost label barcodes can encode more than the tracking number, so a
 * tracking match is "the scan contains the tracking number" (or, for a
 * typed partial, the tracking number contains a long enough input).
 */

export type MatchField = "tracking" | "reference" | "imei" | "quoteId" | "customer";

export interface MatchableQuote {
  id: string;
  tradeInRef?: unknown;
  trackingNumber?: unknown;
  imei?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
}

const MIN_PARTIAL_TRACKING = 8;
const MIN_CUSTOMER_SEARCH = 3;

function compact(value: unknown): string {
  return typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

export function matchParcel(input: string, q: MatchableQuote): MatchField | null {
  const scan = compact(input);
  if (!scan) return null;

  const tracking = compact(q.trackingNumber);
  if (
    tracking &&
    (scan.includes(tracking) ||
      (scan.length >= MIN_PARTIAL_TRACKING && tracking.includes(scan)))
  ) {
    return "tracking";
  }

  const ref = compact(q.tradeInRef);
  if (ref && scan === ref) return "reference";

  const imei = compact(q.imei);
  if (imei && scan === imei) return "imei";

  if (scan === compact(q.id)) return "quoteId";

  const text = input.trim().toLowerCase();
  if (text.length >= MIN_CUSTOMER_SEARCH) {
    const name = typeof q.customerName === "string" ? q.customerName.toLowerCase() : "";
    const email = typeof q.customerEmail === "string" ? q.customerEmail.toLowerCase() : "";
    if (name.includes(text) || email.includes(text)) return "customer";
  }

  return null;
}
