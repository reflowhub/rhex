import { describe, expect, it } from "vitest";
import {
  OPEN_QUOTE_STATUSES,
  QUOTE_STATUSES,
  funnelStage,
  isNotGenuine,
  quoteStatusBadge,
  quoteStatusLabel,
} from "@/lib/quote-status";

describe("quoteStatusLabel", () => {
  it("shows on_hold as Under Review to customers and partners only", () => {
    expect(quoteStatusLabel("on_hold")).toBe("On Hold");
    expect(quoteStatusLabel("on_hold", "public")).toBe("Under Review");
    expect(quoteStatusLabel("paid", "public")).toBe("Paid");
  });

  it("passes unknown statuses through (bulk quotes share the lists)", () => {
    expect(quoteStatusLabel("estimated", "public")).toBe("estimated");
    expect(quoteStatusLabel(undefined)).toBe("");
  });
});

describe("quoteStatusBadge", () => {
  it("styles every status, and falls back to outline", () => {
    for (const status of QUOTE_STATUSES) {
      expect(quoteStatusBadge(status).variant).toBeDefined();
    }
    expect(quoteStatusBadge("cancelled").variant).toBe("destructive");
    expect(quoteStatusBadge("nope")).toEqual({ variant: "outline" });
  });
});

describe("OPEN_QUOTE_STATUSES", () => {
  it("covers every status still in progress", () => {
    expect([...OPEN_QUOTE_STATUSES].sort()).toEqual(
      [
        "quoted",
        "accepted",
        "shipped",
        "received",
        "on_hold",
        "revised",
        "inspected",
        "returning",
      ].sort()
    );
  });
});

describe("isNotGenuine", () => {
  it("matches only not_genuine cancellations", () => {
    expect(isNotGenuine({ status: "cancelled", cancelReason: "not_genuine" })).toBe(true);
    expect(isNotGenuine({ status: "cancelled", cancelReason: "duplicate" })).toBe(false);
    expect(isNotGenuine({ status: "quoted", cancelReason: "not_genuine" })).toBe(false);
  });
});

describe("funnelStage", () => {
  it("keeps main-path statuses", () => {
    expect(funnelStage({ status: "quoted" })).toBe("quoted");
    expect(funnelStage({ status: "shipped" })).toBe("shipped");
    expect(funnelStage({ status: "paid" })).toBe("paid");
  });

  it("maps expired quotes to how far they got", () => {
    expect(funnelStage({ status: "expired" })).toBe("quoted");
    expect(funnelStage({ status: "expired", acceptedAt: new Date() })).toBe("accepted");
  });

  it("counts revised, held and returned devices as received or inspected", () => {
    expect(funnelStage({ status: "revised" })).toBe("received");
    expect(funnelStage({ status: "on_hold" })).toBe("received");
    expect(funnelStage({ status: "on_hold", inspectedAt: new Date() })).toBe("inspected");
    expect(funnelStage({ status: "returning" })).toBe("received");
    expect(funnelStage({ status: "returned", inspectedAt: new Date() })).toBe("inspected");
  });

  it("leaves out cancelled and unknown statuses", () => {
    expect(funnelStage({ status: "cancelled" })).toBeNull();
    expect(funnelStage({ status: "estimated" })).toBeNull();
  });
});
