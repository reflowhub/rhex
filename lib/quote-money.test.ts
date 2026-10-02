import { describe, expect, it } from "vitest";
import {
  convertPrice,
  maskTail,
  originalAmount,
  payableAmount,
  payoutSnapshot,
  toQuoteCurrency,
} from "@/lib/quote-money";

const AUD_QUOTE = {
  quotePriceNZD: 200,
  quotePriceDisplay: 180, // floor5(200 × 0.92)
  displayCurrency: "AUD",
  fxRate: 0.92,
};

const NZD_QUOTE = {
  quotePriceNZD: 200,
  quotePriceDisplay: 200,
  displayCurrency: "NZD",
  fxRate: 1,
};

describe("convertPrice", () => {
  it("rounds customer prices down to $5 by default", () => {
    expect(convertPrice(200, "AUD", 0.92)).toBe(180);
    expect(convertPrice(150, "AUD", 0.92)).toBe(135);
    expect(convertPrice(150, "AUD", 0.92, 0)).toBe(138);
    expect(convertPrice(149.99, "NZD", 0.92)).toBe(149.99);
  });
});

describe("toQuoteCurrency", () => {
  it("converts at the quote's locked rate", () => {
    expect(toQuoteCurrency(AUD_QUOTE, 150)).toBe(135);
    expect(toQuoteCurrency({ ...AUD_QUOTE, fxRate: 0.5 }, 150)).toBe(75);
    expect(toQuoteCurrency(NZD_QUOTE, 150)).toBe(150);
  });

  it("returns null for an AUD quote without a rate", () => {
    expect(toQuoteCurrency({ displayCurrency: "AUD" }, 150)).toBeNull();
  });
});

describe("payableAmount", () => {
  it("is the original quote when there is no revision", () => {
    expect(payableAmount(AUD_QUOTE)).toEqual({
      amount: 180,
      currency: "AUD",
      amountNZD: 200,
      revised: false,
    });
    expect(payableAmount(NZD_QUOTE)).toEqual({
      amount: 200,
      currency: "NZD",
      amountNZD: 200,
      revised: false,
    });
  });

  it("is the stored revised amount when there is one", () => {
    expect(
      payableAmount({ ...AUD_QUOTE, revisedPriceNZD: 150, revisedPriceDisplay: 130 })
    ).toEqual({ amount: 130, currency: "AUD", amountNZD: 150, revised: true });
  });

  it("converts a revision saved before revisedPriceDisplay existed", () => {
    expect(payableAmount({ ...AUD_QUOTE, revisedPriceNZD: 150 })).toEqual({
      amount: 135,
      currency: "AUD",
      amountNZD: 150,
      revised: true,
    });
  });

  it("falls back to NZD rather than guessing a rate", () => {
    const legacy = { quotePriceNZD: 200, displayCurrency: "AUD", revisedPriceNZD: 150 };
    expect(payableAmount(legacy)).toEqual({
      amount: 150,
      currency: "NZD",
      amountNZD: 150,
      revised: true,
    });
    expect(originalAmount({ quotePriceNZD: 200, displayCurrency: "AUD" })).toEqual({
      amount: 200,
      currency: "NZD",
    });
  });

  it("treats unset currency as NZD", () => {
    expect(payableAmount({ quotePriceNZD: 99 }).currency).toBe("NZD");
  });
});

describe("payoutSnapshot", () => {
  const paidAt = new Date("2026-10-02T00:00:00Z");

  it("masks account numbers and records the payable amount", () => {
    const snap = payoutSnapshot(
      {
        ...AUD_QUOTE,
        revisedPriceNZD: 150,
        revisedPriceDisplay: 135,
        paymentMethod: "bank_transfer",
        bankBSB: "062-000",
        bankAccountNumber: "1234 5678",
        bankAccountName: "Sam Seller",
        payIdPhone: "0400000123",
      },
      paidAt,
      "admin@rhex.app"
    );
    expect(snap).toEqual({
      method: "bank_transfer",
      payIdPhone: null,
      bankBSB: "062-000",
      bankAccountNumber: "•••• 678",
      bankAccountName: "Sam Seller",
      amount: 135,
      currency: "AUD",
      amountNZD: 150,
      paidAt,
      paidBy: "admin@rhex.app",
    });
  });

  it("keeps only the masked PayID for PayID payouts", () => {
    const snap = payoutSnapshot(
      { ...NZD_QUOTE, paymentMethod: "payid", payIdPhone: "0400000123", bankBSB: "062-000" },
      paidAt,
      null
    );
    expect(snap).toMatchObject({
      method: "payid",
      payIdPhone: "•••• 123",
      bankBSB: null,
      bankAccountNumber: null,
    });
  });

  it("has no method for Mode B quotes without payout details", () => {
    expect(payoutSnapshot(NZD_QUOTE, paidAt, null).method).toBeNull();
  });
});

describe("maskTail", () => {
  it("keeps the last 3 characters", () => {
    expect(maskTail("0400 000 123")).toBe("•••• 123");
    expect(maskTail("12")).toBe("••••");
    expect(maskTail("")).toBeNull();
    expect(maskTail(undefined)).toBeNull();
  });
});
