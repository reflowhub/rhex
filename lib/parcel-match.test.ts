import { describe, expect, it } from "vitest";
import { matchParcel, type MatchableQuote } from "@/lib/parcel-match";

const quote: MatchableQuote = {
  id: "jd76EnClNvl6GHkxHNAe",
  tradeInRef: "TI-1001",
  trackingNumber: "33ABC1234567",
  imei: "356789012345678",
  customerName: "Sam Seller",
  customerEmail: "sam@example.com",
};

describe("matchParcel", () => {
  it("matches a barcode that contains the tracking number", () => {
    expect(matchParcel("019931265099999891 33ABC1234567 0090", quote)).toBe("tracking");
    expect(matchParcel("33abc1234567", quote)).toBe("tracking");
  });

  it("matches a long enough partial tracking number", () => {
    expect(matchParcel("ABC12345", quote)).toBe("tracking");
    expect(matchParcel("1234", quote)).toBeNull();
  });

  it("matches the TI- reference with or without the dash", () => {
    expect(matchParcel("TI-1001", quote)).toBe("reference");
    expect(matchParcel("ti1001", quote)).toBe("reference");
    expect(matchParcel("TI-100", quote)).toBeNull();
  });

  it("matches the IMEI and the quote ID exactly", () => {
    expect(matchParcel("356789012345678", quote)).toBe("imei");
    expect(matchParcel("jd76EnClNvl6GHkxHNAe", quote)).toBe("quoteId");
  });

  it("matches customer name or email from three characters", () => {
    expect(matchParcel("seller", quote)).toBe("customer");
    expect(matchParcel("SAM@EXAMPLE", quote)).toBe("customer");
    expect(matchParcel("sa", quote)).toBeNull();
  });

  it("ignores empty input and quotes without the field", () => {
    expect(matchParcel("  ", quote)).toBeNull();
    expect(matchParcel("33ABC1234567", { id: "x" })).toBeNull();
  });
});
