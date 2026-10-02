/**
 * HMAC signing for Mode C result notifications (server only).
 * See docs/partners/oppo-trade-in-result-api.md.
 */

import { createHmac } from "node:crypto";

/** Lowercase hex HMAC-SHA256 of `${timestamp}.${rawBody}`. */
export function signPartnerResult(
  secret: string,
  timestamp: string,
  rawBody: string
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

/** Request headers for one delivery attempt, signed at send time. */
export function partnerResultHeaders(
  secret: string,
  rawBody: string,
  now: Date = new Date()
): Record<string, string> {
  const timestamp = String(now.getTime());
  return {
    "Content-Type": "application/json",
    "x-trade-in-timestamp": timestamp,
    "x-trade-in-signature": signPartnerResult(secret, timestamp, rawBody),
  };
}
