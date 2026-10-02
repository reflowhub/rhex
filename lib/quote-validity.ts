/**
 * How long an unaccepted quote stays open (docs/TRADEIN-STATES-PLAN.md D1).
 * Client-safe.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Public quotes (/sell and the embed) */
export const PUBLIC_QUOTE_VALIDITY_MS = 24 * HOUR_MS;
/** Partner portal, v1 API and admin-created quotes, until the Mode A/B review */
export const PARTNER_QUOTE_VALIDITY_MS = 14 * DAY_MS;

/** Time left before `expiresAt`, e.g. "3 days", "18 hours", "40 minutes". */
export function formatTimeLeft(
  expiresAt: Date | string,
  now: Date = new Date()
): string {
  const ms = Math.max(0, new Date(expiresAt).getTime() - now.getTime());
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (ms >= 2 * DAY_MS) return plural(Math.floor(ms / DAY_MS), "day");
  if (ms >= HOUR_MS) return plural(Math.floor(ms / HOUR_MS), "hour");
  return plural(Math.max(1, Math.ceil(ms / 60000)), "minute");
}
