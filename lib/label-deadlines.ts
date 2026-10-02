/**
 * Shipping label deadlines (docs/TRADEIN-STATES-PLAN.md D2 and the timeline
 * in §3). Client-safe: used by the admin queues and the customer page.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Customer must lodge the parcel within this many days of the label being sent */
export const POST_BY_DAYS = 14;
/** Transit allowance after postByAt before a parcel counts as overdue */
export const TRANSIT_ALLOWANCE_DAYS = 10;
/** Unrefunded labels are flagged urgent this many days after they were sent */
export const REFUND_URGENT_DAYS = 75;
/** AusPost refund deadline, in days after the label was created */
export const REFUND_DEADLINE_DAYS = 90;

export function labelDeadlines(labelSentAt: Date): {
  postByAt: Date;
  expectedByAt: Date;
} {
  const postByAt = new Date(labelSentAt.getTime() + POST_BY_DAYS * DAY_MS);
  const expectedByAt = new Date(
    postByAt.getTime() + TRANSIT_ALLOWANCE_DAYS * DAY_MS
  );
  return { postByAt, expectedByAt };
}

/** Whole days elapsed since `from`. */
export function daysSince(from: Date | string, now: Date = new Date()): number {
  const start = typeof from === "string" ? new Date(from) : from;
  return Math.floor((now.getTime() - start.getTime()) / DAY_MS);
}

/** Date shown to Australian customers, e.g. "16 October 2026". */
export function formatCustomerDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  });
}
