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

// ---------------------------------------------------------------------------
// Mode C label turnaround (docs/partners/OPPO.md, 2d)
// ---------------------------------------------------------------------------

const SYDNEY = "Australia/Sydney";

/** Sydney calendar date of an instant. */
function sydneyDay(at: Date): { y: number; m: number; d: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SYDNEY,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(at)
      .map((p) => [p.type, Number(p.value)])
  );
  return { y: parts.year, m: parts.month, d: parts.day };
}

/** Sydney's UTC offset at an instant, in ms (+10h or +11h). */
function sydneyOffsetMs(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SYDNEY,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
      .formatToParts(at)
      .map((x) => [x.type, Number(x.value)])
  );
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return local - Math.floor(at.getTime() / 60000) * 60000;
}

/** Midnight at the start of a Sydney calendar date (DST never changes at midnight). */
function sydneyMidnight(y: number, m: number, d: number): Date {
  const utcMidnight = Date.UTC(y, m - 1, d);
  const guess = new Date(utcMidnight - 10 * 60 * 60 * 1000);
  return new Date(utcMidnight - sydneyOffsetMs(guess));
}

/**
 * When a Mode C label is due: by the end of the next Sydney business day
 * (Monday to Friday; public holidays aren't counted) after acceptance. So
 * Monday's acceptances are due by the end of Tuesday, and Friday's to
 * Sunday's by the end of Monday. Returns the instant the label becomes
 * overdue (midnight after the due day). Internal only: customers and the
 * partner never see it.
 */
export function labelDueAt(acceptedAt: Date): Date {
  const day = sydneyDay(acceptedAt);
  // Walk forward from the day after acceptance to a weekday
  let date = new Date(Date.UTC(day.y, day.m - 1, day.d + 1));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date = new Date(date.getTime() + DAY_MS);
  }
  // Overdue from the midnight that ends that day
  const next = new Date(date.getTime() + DAY_MS);
  return sydneyMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
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
  if (q.status !== "accepted" || q.partnerMode === "B") return null;
  // Sandbox reminders only for Mode C, whose emails go to test inboxes
  if (q.sandbox === true && q.partnerMode !== "C") return null;
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
