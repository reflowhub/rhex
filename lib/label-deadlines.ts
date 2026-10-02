/**
 * Shipping label deadlines (docs/TRADEIN-STATES-PLAN.md D2 and the timeline
 * in §3). Client-safe: used by the admin queues and the customer page.
 */

import { toDate, type QuoteData } from "@/lib/quote-transitions";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Customer must lodge the parcel within this many days of the label being sent */
export const POST_BY_DAYS = 14;
/** Transit allowance after postByAt before a parcel counts as overdue */
export const TRANSIT_ALLOWANCE_DAYS = 10;
/** Unrefunded labels are flagged urgent this many days after they were sent */
export const REFUND_URGENT_DAYS = 75;
/** AusPost refund deadline, in days after the label was created */
export const REFUND_DEADLINE_DAYS = 90;
/** Reminder emails, in days after the label was sent */
export const LABEL_REMINDER_DAYS = [7, 12] as const;

export type LabelReminder = `day${(typeof LABEL_REMINDER_DAYS)[number]}`;

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

/**
 * The label reminder to send now, if any. Only for accepted quotes (not yet
 * marked shipped or received) before postByAt. Each reminder is recorded in
 * `remindersSent` and sent once; if two are due, only the later one is sent.
 */
export function dueLabelReminder(
  q: QuoteData,
  now: Date = new Date()
): LabelReminder | null {
  if (q.status !== "accepted" || q.sandbox === true) return null;
  const sentAt = toDate(q.labelSentAt);
  const postBy = toDate(q.postByAt);
  if (!sentAt || !postBy || postBy.getTime() <= now.getTime()) return null;

  const sent = (q.remindersSent ?? {}) as Record<string, unknown>;
  const age = now.getTime() - sentAt.getTime();
  for (const day of [...LABEL_REMINDER_DAYS].reverse()) {
    if (age >= day * DAY_MS) {
      const key: LabelReminder = `day${day}`;
      return sent[key] ? null : key;
    }
  }
  return null;
}
