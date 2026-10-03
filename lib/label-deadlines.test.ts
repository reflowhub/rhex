import { describe, expect, it } from "vitest";
import { dueLabelReminder, labelDueAt } from "@/lib/label-deadlines";
import type { QuoteData } from "@/lib/quote-transitions";

const NOW = new Date("2026-10-02T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const past = (days: number) => new Date(NOW.getTime() - days * DAY);

/** An accepted quote whose label was sent `days` ago (post by = sent + 14d). */
function sentDaysAgo(days: number, extra: QuoteData = {}): QuoteData {
  return {
    status: "accepted",
    customerEmail: "a@example.com",
    labelSentAt: past(days),
    postByAt: past(days - 14),
    ...extra,
  };
}

describe("dueLabelReminder", () => {
  it("is not due before day 7", () => {
    expect(dueLabelReminder(sentDaysAgo(0), NOW)).toBeNull();
    expect(dueLabelReminder(sentDaysAgo(6.9), NOW)).toBeNull();
  });

  it("sends day 7, then day 12, once each", () => {
    expect(dueLabelReminder(sentDaysAgo(7), NOW)).toBe("day7");
    expect(
      dueLabelReminder(sentDaysAgo(8, { remindersSent: { day7: past(1) } }), NOW)
    ).toBeNull();
    expect(
      dueLabelReminder(sentDaysAgo(12, { remindersSent: { day7: past(5) } }), NOW)
    ).toBe("day12");
    expect(
      dueLabelReminder(
        sentDaysAgo(13, { remindersSent: { day7: past(6), day12: past(1) } }),
        NOW
      )
    ).toBeNull();
  });

  it("skips a missed day-7 reminder once day 12 is reached", () => {
    expect(dueLabelReminder(sentDaysAgo(12), NOW)).toBe("day12");
  });

  it("stops at postByAt", () => {
    expect(dueLabelReminder(sentDaysAgo(14), NOW)).toBeNull();
    expect(dueLabelReminder(sentDaysAgo(20), NOW)).toBeNull();
  });

  it("is only for accepted, non-sandbox quotes with a label", () => {
    expect(dueLabelReminder(sentDaysAgo(7, { status: "shipped" }), NOW)).toBeNull();
    expect(dueLabelReminder(sentDaysAgo(7, { status: "received" }), NOW)).toBeNull();
    expect(dueLabelReminder(sentDaysAgo(7, { sandbox: true }), NOW)).toBeNull();
    expect(
      dueLabelReminder({ status: "accepted", customerEmail: "a@example.com" }, NOW)
    ).toBeNull();
  });
});

describe("labelDueAt (Mode C, end of the next Sydney business day)", () => {
  const due = (iso: string) => labelDueAt(new Date(iso)).toISOString();

  it("a weekday acceptance is due by the end of the next day", () => {
    // Mon 5 Oct 10:00 AEDT → overdue from Wed 7 Oct 00:00 AEDT
    expect(due("2026-10-04T23:00:00Z")).toBe("2026-10-06T13:00:00.000Z");
  });

  it("Friday to Sunday acceptances are due by the end of Monday", () => {
    const monday = "2026-10-12T13:00:00.000Z"; // Tue 13 Oct 00:00 AEDT
    expect(due("2026-10-09T04:00:00Z")).toBe(monday); // Fri 15:00
    expect(due("2026-10-10T01:00:00Z")).toBe(monday); // Sat 12:00
    expect(due("2026-10-11T12:30:00Z")).toBe(monday); // Sun 23:30
  });

  it("uses the Sydney date, not UTC", () => {
    // Tue 6 Oct 08:00 AEDT is still Monday in UTC
    expect(due("2026-10-05T21:00:00Z")).toBe("2026-10-07T13:00:00.000Z");
  });

  it("handles daylight saving starting in between", () => {
    // Fri 2 Oct 12:00 AEST → overdue from Tue 6 Oct 00:00 AEDT
    expect(due("2026-10-02T02:00:00Z")).toBe("2026-10-05T13:00:00.000Z");
  });

  it("works in standard time", () => {
    // Wed 15 Jul 09:00 AEST → overdue from Fri 17 Jul 00:00 AEST
    expect(due("2026-07-14T23:00:00Z")).toBe("2026-07-16T14:00:00.000Z");
  });
});
