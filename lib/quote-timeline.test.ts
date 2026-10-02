import { describe, expect, it } from "vitest";
import { customerTimeline } from "@/lib/quote-timeline";

const at = (day: number) => new Date(Date.UTC(2026, 9, day, 1));
const iso = (day: number) => at(day).toISOString();

describe("customerTimeline", () => {
  it("lists each status once, oldest first, with the label in between", () => {
    const timeline = customerTimeline({
      createdAt: at(1),
      labelSentAt: at(3),
      statusHistory: [
        { from: "quoted", to: "accepted", actor: "customer", at: at(2), reason: null },
        { from: "accepted", to: "received", actor: "admin", at: at(8), reason: null },
        { from: "received", to: "on_hold", actor: "admin", at: at(9), reason: "IMEI blacklisted?" },
        { from: "on_hold", to: "received", actor: "admin", at: at(10), reason: "cleared" },
        { from: "received", to: "inspected", actor: "admin", at: at(11), reason: null },
      ],
    });
    expect(timeline).toEqual([
      { step: "quoted", at: iso(1) },
      { step: "accepted", at: iso(2) },
      { step: "label_sent", at: iso(3) },
      { step: "received", at: iso(8) },
      { step: "on_hold", at: iso(9) },
      { step: "inspected", at: iso(11) },
    ]);
  });

  it("never carries actor or reason", () => {
    const timeline = customerTimeline({
      createdAt: at(1),
      statusHistory: [
        { from: "quoted", to: "cancelled", actor: "admin", actorId: "a@x", at: at(2), reason: "bot" },
      ],
    });
    for (const entry of timeline) {
      expect(Object.keys(entry).sort()).toEqual(["at", "step"]);
    }
  });

  it("accepts Firestore-style timestamps", () => {
    const ts = { toDate: () => at(2) };
    expect(
      customerTimeline({
        createdAt: at(1),
        statusHistory: [{ to: "accepted", at: ts }],
      })
    ).toEqual([
      { step: "quoted", at: iso(1) },
      { step: "accepted", at: iso(2) },
    ]);
  });

  it("falls back to timestamp fields for quotes without statusHistory", () => {
    expect(
      customerTimeline({
        createdAt: at(1),
        acceptedAt: at(2),
        receivedAt: at(6),
        paidAt: at(9),
      })
    ).toEqual([
      { step: "quoted", at: iso(1) },
      { step: "accepted", at: iso(2) },
      { step: "received", at: iso(6) },
      { step: "paid", at: iso(9) },
    ]);
  });

  it("ignores malformed history entries", () => {
    expect(
      customerTimeline({
        createdAt: at(1),
        statusHistory: [null, { to: "bogus", at: at(2) }, { to: "accepted" }],
      })
    ).toEqual([{ step: "quoted", at: iso(1) }]);
  });
});
