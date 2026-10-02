import { describe, expect, it } from "vitest";
import { dueLabelReminder } from "@/lib/label-deadlines";
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
