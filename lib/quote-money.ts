/**
 * Trade-in money helpers: customer-currency conversion at a quote's locked
 * FX rate, the amount payable, and the payout snapshot saved at `paid`.
 * Client-safe: no server imports.
 *
 * See docs/TRADEIN-STATES-PLAN.md D6 and Phase 4.
 */

/** The quote fields these helpers read (stored data or an API response). */
export interface QuoteMoneyFields {
  quotePriceNZD?: unknown;
  quotePriceDisplay?: unknown;
  displayCurrency?: unknown;
  fxRate?: unknown;
  revisedPriceNZD?: unknown;
  revisedPriceDisplay?: unknown;
  paymentMethod?: unknown;
  payIdPhone?: unknown;
  bankBSB?: unknown;
  bankAccountNumber?: unknown;
  bankAccountName?: unknown;
}

export type QuoteCurrency = "AUD" | "NZD";

export interface PayableAmount {
  /** In the customer's currency */
  amount: number;
  currency: QuoteCurrency;
  /** For inventory cost, commission and customer totals */
  amountNZD: number;
  /** True when a revised offer replaced the original quote */
  revised: boolean;
}

/**
 * Convert NZD price to display currency with optional rounding.
 * Prices shown to customers are rounded down to $5 (the default).
 */
export function convertPrice(
  priceNZD: number,
  currency: QuoteCurrency,
  fxRate: number,
  roundTo: number = 5
): number {
  if (currency === "NZD") return priceNZD;
  const converted = priceNZD * fxRate;
  if (roundTo <= 0) return Math.round(converted * 100) / 100;
  return Math.floor(converted / roundTo) * roundTo;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** The customer's currency for a quote (NZD when unset). */
export function quoteCurrency(q: QuoteMoneyFields): QuoteCurrency {
  return q.displayCurrency === "AUD" ? "AUD" : "NZD";
}

/**
 * An NZD amount in the quote's currency at its locked fxRate, rounded the
 * same way as the original quote. Null when an AUD quote has no fxRate.
 */
export function toQuoteCurrency(q: QuoteMoneyFields, amountNZD: number): number | null {
  const currency = quoteCurrency(q);
  if (currency === "NZD") return amountNZD;
  const fxRate = num(q.fxRate);
  if (!fxRate || fxRate <= 0) return null;
  return convertPrice(amountNZD, currency, fxRate);
}

/** The original quote in the customer's currency. */
export function originalAmount(q: QuoteMoneyFields): {
  amount: number;
  currency: QuoteCurrency;
} {
  const nzd = num(q.quotePriceNZD) ?? 0;
  const display = num(q.quotePriceDisplay) ?? toQuoteCurrency(q, nzd);
  return display === null
    ? { amount: nzd, currency: "NZD" }
    : { amount: display, currency: quoteCurrency(q) };
}

/**
 * What RHEX pays for a quote: the revised offer if one was made (a quote
 * that carries a revised price was revised, D12), otherwise the original.
 */
export function payableAmount(q: QuoteMoneyFields): PayableAmount {
  const revisedNZD = num(q.revisedPriceNZD);
  if (revisedNZD === null) {
    const original = originalAmount(q);
    return {
      ...original,
      amountNZD: num(q.quotePriceNZD) ?? 0,
      revised: false,
    };
  }

  const display = num(q.revisedPriceDisplay) ?? toQuoteCurrency(q, revisedNZD);
  return display === null
    ? { amount: revisedNZD, currency: "NZD", amountNZD: revisedNZD, revised: true }
    : {
        amount: display,
        currency: quoteCurrency(q),
        amountNZD: revisedNZD,
        revised: true,
      };
}

/** e.g. "$135.00 AUD" */
export function formatMoney(amount: number, currency: string): string {
  return `$${amount.toFixed(2)} ${currency}`;
}

// ---------------------------------------------------------------------------
// Payout snapshot
// ---------------------------------------------------------------------------

/** Mask all but the last 3 characters, e.g. "•••• 123". */
export function maskTail(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const compact = value.replace(/\s/g, "");
  return compact.length > 3 ? `•••• ${compact.slice(-3)}` : "••••";
}

export interface PayoutSnapshot {
  method: string | null;
  payIdPhone: string | null;
  bankBSB: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  amount: number;
  currency: QuoteCurrency;
  amountNZD: number;
  paidAt: Date;
  paidBy: string | null;
}

/**
 * What was paid and where, saved on the quote at `paid` so later edits to
 * the customer record can't change it. Account numbers are masked.
 */
export function payoutSnapshot(
  q: QuoteMoneyFields,
  paidAt: Date,
  paidBy: string | null
): PayoutSnapshot {
  const method =
    q.paymentMethod === "payid" || q.paymentMethod === "bank_transfer"
      ? q.paymentMethod
      : null;
  const payable = payableAmount(q);
  return {
    method,
    payIdPhone: method === "payid" ? maskTail(q.payIdPhone) : null,
    bankBSB:
      method === "bank_transfer" && typeof q.bankBSB === "string"
        ? q.bankBSB
        : null,
    bankAccountNumber:
      method === "bank_transfer" ? maskTail(q.bankAccountNumber) : null,
    bankAccountName:
      method === "bank_transfer" && typeof q.bankAccountName === "string"
        ? q.bankAccountName
        : null,
    amount: payable.amount,
    currency: payable.currency,
    amountNZD: payable.amountNZD,
    paidAt,
    paidBy,
  };
}

// ---------------------------------------------------------------------------
// Mode C settlement snapshot
// ---------------------------------------------------------------------------

export interface PartnerSettlementSnapshot {
  /** The partner that refunds the customer and is settled in the net statement */
  partnerId: string | null;
  /** The approved trade-in value the partner refunds, in the quote's currency */
  amount: number;
  currency: QuoteCurrency;
  amountNZD: number;
  approvedAt: Date;
  approvedBy: string | null;
}

/**
 * Saved on a Mode C quote at `paid` (approved) instead of a payout: RHEX
 * pays nobody directly; the partner refunds the customer this amount.
 */
export function partnerSettlementSnapshot(
  q: QuoteMoneyFields & { partnerId?: unknown },
  approvedAt: Date,
  approvedBy: string | null
): PartnerSettlementSnapshot {
  const payable = payableAmount(q);
  return {
    partnerId: typeof q.partnerId === "string" ? q.partnerId : null,
    amount: payable.amount,
    currency: payable.currency,
    amountNZD: payable.amountNZD,
    approvedAt,
    approvedBy,
  };
}
