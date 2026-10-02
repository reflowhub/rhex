import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  classifyDelivery,
  isResultGrade,
  partnerResultUrl,
  retryDelayMs,
} from "@/lib/partner-result";
import { partnerResultHeaders, signPartnerResult } from "@/lib/partner-result-signing";

describe("signing (docs/partners/oppo-trade-in-result-api.md)", () => {
  // The spec's example body
  const body = JSON.stringify({ approvedQuotePrice: 280, acceptGrading: "B", accepted: true });

  it("is lowercase hex HMAC-SHA256 of `${timestamp}.${rawBody}`", () => {
    const expected = createHmac("sha256", "secret").update(`1700000000000.${body}`).digest("hex");
    expect(signPartnerResult("secret", "1700000000000", body)).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signs each attempt with its own millisecond timestamp", () => {
    const a = partnerResultHeaders("secret", body, new Date(1_700_000_000_000));
    const b = partnerResultHeaders("secret", body, new Date(1_700_000_060_000));
    expect(a["x-trade-in-timestamp"]).toBe("1700000000000");
    expect(a["x-trade-in-signature"]).toBe(signPartnerResult("secret", "1700000000000", body));
    expect(b["x-trade-in-signature"]).not.toBe(a["x-trade-in-signature"]);
    expect(a["Content-Type"]).toBe("application/json");
  });
});

describe("partnerResultUrl", () => {
  it("fills in the URL-encoded quote ID", () => {
    expect(partnerResultUrl("https://x.test/api/trade-in/{quoteId}", "ab/c d")).toBe(
      "https://x.test/api/trade-in/ab%2Fc%20d"
    );
  });
});

describe("isResultGrade", () => {
  it("accepts A–E only", () => {
    for (const g of ["A", "B", "C", "D", "E"]) expect(isResultGrade(g)).toBe(true);
    for (const g of ["F", "a", "", null, undefined]) expect(isResultGrade(g)).toBe(false);
  });
});

describe("classifyDelivery", () => {
  it("2xx is delivered", () => {
    expect(classifyDelivery(200, 1)).toBe("sent");
    expect(classifyDelivery(204, 1)).toBe("sent");
  });

  it("doesn't retry 400, 401 or 404", () => {
    for (const s of [400, 401, 404, 403, 422]) expect(classifyDelivery(s, 1)).toBe("failed");
  });

  it("retries 500, 502, other 5xx, 429 and network errors", () => {
    for (const s of [500, 502, 503, 504, 429, null]) expect(classifyDelivery(s, 1)).toBe("retry");
  });

  it("gives up after the last attempt", () => {
    expect(classifyDelivery(502, MAX_ATTEMPTS - 1)).toBe("retry");
    expect(classifyDelivery(502, MAX_ATTEMPTS)).toBe("failed");
  });
});

describe("retryDelayMs", () => {
  it("backs off 1m, 5m, 15m, … and caps at 24h", () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(5 * 60_000);
    expect(retryDelayMs(3)).toBe(15 * 60_000);
    expect(retryDelayMs(99)).toBe(RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
    expect(RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]).toBe(24 * 60 * 60_000);
  });
});
