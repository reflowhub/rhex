/**
 * Trade-in quote state machine: the transition table, guards and the fields
 * each transition writes. Pure (no Firestore), so it can be unit tested;
 * lib/transition-quote.ts applies a plan inside a transaction.
 *
 * See docs/TRADEIN-STATES-PLAN.md §3 for the table this implements.
 */

import {
  CANCEL_REASONS,
  type CancelReason,
  type QuoteActor,
  type QuoteStatus,
  isLateDecision,
  isQuoteStatus,
} from "@/lib/quote-status";
import {
  formatMoney,
  originalAmount,
  partnerSettlementSnapshot,
  payoutSnapshot,
  toQuoteCurrency,
} from "@/lib/quote-money";
import { partnerResultFor, type PartnerResultBody } from "@/lib/partner-result";
import { TRADEIN_TERMS_VERSION } from "@/lib/tradein-terms";
import { formatAuAddress, parseAuAddress, type AuAddress } from "@/lib/au-address";
import {
  REFLOW_LABELS,
  labelPaidBy,
  quoteLabelArrangement,
  type LabelArrangement,
  type LabelTerms,
} from "@/lib/partner-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stored quote data. Timestamps may be Firestore Timestamps, Dates or ISO strings. */
export type QuoteData = Record<string, unknown>;

export interface TransitionContext {
  actor: QuoteActor;
  /** Admin email, partner ID or API key ID, for statusHistory */
  actorId?: string | null;
  now: Date;
  /** Request fields for this transition (contact details, grade, IMEI, ...) */
  payload?: Record<string, unknown>;
  /** Free-text reason or note */
  reason?: string | null;
  /** Days a customer has to respond to a revised offer */
  revisionExpiryDays?: number;
  /** Mode C: the partner's never-arrived setting (lib/partner-config.ts) */
  neverArrivedResult?: boolean;
  /** Mode C: the partner's label settings, copied onto the quote at acceptance */
  labelArrangement?: LabelArrangement;
}

/** A return label Reflow made, recorded when the device is marked returned. */
export interface ReturnLabelPlan extends LabelTerms {
  trackingNumber: string | null;
  costAUD: number | null;
}

/** Work done after commit, only by the call that made the change. */
export type SideEffect =
  | "link_customer"
  | "accepted_email"
  | "revised_email"
  | "commission"
  | "paid_email"
  | "expired_email"
  | "returned_email"
  /** Mode C only: device arrived, going back, approved (replaces paid_email), cancelled */
  | "received_email"
  | "returning_email"
  | "approved_email"
  | "cancelled_email"
  | "queue_label_refund"
  /** Take the quote's value off the linked customer's totalValueNZD */
  | "reverse_customer_value"
  /** Add it back (an expired quote received after all) */
  | "restore_customer_value"
  /** Mode C: deliver the queued result notification to the partner */
  | "partner_result";

export interface StatusHistoryEntry {
  from: QuoteStatus;
  to: QuoteStatus;
  actor: QuoteActor;
  actorId: string | null;
  at: Date;
  reason: string | null;
}

export type TransitionErrorCode =
  | "invalid_transition"
  | "forbidden"
  | "guard_failed";

export type TransitionPlan =
  | {
      ok: true;
      from: QuoteStatus;
      to: QuoteStatus;
      /** Fields to write, including status, timestamp and statusHistory */
      update: Record<string, unknown>;
      historyEntry: StatusHistoryEntry;
      effects: SideEffect[];
      /** Assign the next TI- reference in the same transaction */
      assignReference: boolean;
      /** Mode C: the final outcome to queue for the partner in the same transaction */
      partnerResult: PartnerResultBody | null;
      /** A `shippingLabels` entry to create in the same transaction */
      returnLabel: ReturnLabelPlan | null;
    }
  | { ok: false; code: TransitionErrorCode; message: string };

type ApplyResult =
  | { error: string }
  | {
      fields: Record<string, unknown>;
      effects?: SideEffect[];
      returnLabel?: { trackingNumber: string | null; costAUD: number | null };
    };

interface Rule {
  from: QuoteStatus;
  to: QuoteStatus;
  actors: readonly QuoteActor[];
  /** Checks against the stored quote; returns an error message or null */
  state?: (q: QuoteData, ctx: TransitionContext) => string | null;
  /** Validates the payload and returns the fields to write */
  apply?: (q: QuoteData, ctx: TransitionContext) => ApplyResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
/** Used when settings/trade-in has no revisionResponseDays (D3) */
export const DEFAULT_REVISION_RESPONSE_DAYS = 7;
/** An accepted quote expires this many days after postByAt (D2) */
export const LATE_EXPIRY_GRACE_DAYS = 30;
/** Mode C: re-quote reminder this many hours before revisionExpiresAt */
export const REVISION_REMINDER_HOURS = 48;

export const STATUS_TIMESTAMP_FIELDS: Record<QuoteStatus, string> = {
  quoted: "createdAt",
  accepted: "acceptedAt",
  shipped: "shippedAt",
  received: "receivedAt",
  on_hold: "onHoldAt",
  revised: "revisedAt",
  inspected: "inspectedAt",
  paid: "paidAt",
  returning: "returningAt",
  returned: "returnedAt",
  expired: "expiredAt",
  cancelled: "cancelledAt",
};

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isPast(value: unknown, now: Date): boolean {
  const d = toDate(value);
  return d !== null && d.getTime() <= now.getTime();
}

/** Mode B: the partner buys and ships the device; RHEX deals only with the partner. */
export function isModeB(q: QuoteData): boolean {
  return q.partnerMode === "B";
}

/**
 * Mode C: RHEX buys the device from the partner's customer; the partner
 * refunds the customer and receives the final result (docs/PARTNERSHIP.md).
 */
export function isModeC(q: QuoteData): boolean {
  return q.partnerMode === "C";
}

/** Side effects that reach the end customer, dropped for Mode B. */
const CUSTOMER_EFFECTS: readonly SideEffect[] = [
  "link_customer",
  "accepted_email",
  "revised_email",
  "paid_email",
  "expired_email",
  "returned_email",
  "received_email",
  "returning_email",
  "approved_email",
  "cancelled_email",
  "reverse_customer_value",
  "restore_customer_value",
];

const PAYMENT_FIELDS = [
  "paymentMethod",
  "payIdPhone",
  "bankBSB",
  "bankAccountNumber",
  "bankAccountName",
] as const;

function hasPaymentFields(p: Record<string, unknown>): boolean {
  return PAYMENT_FIELDS.some((f) => str(p[f]) !== null);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasPayoutDetails(q: QuoteData): boolean {
  if (q.paymentMethod === "payid") return !!str(q.payIdPhone);
  if (q.paymentMethod === "bank_transfer") {
    return !!(str(q.bankBSB) && str(q.bankAccountNumber) && str(q.bankAccountName));
  }
  return false;
}

function requireReason(ctx: TransitionContext, message: string): ApplyResult {
  const reason = str(ctx.reason);
  return reason ? { fields: {} } : { error: message };
}

/** Optional revised device: all four fields, or none. */
function revisedDeviceFields(
  payload: Record<string, unknown>
): { error: string } | { fields: Record<string, unknown> } {
  const id = str(payload.revisedDeviceId);
  if (!id) return { fields: {} };
  const make = str(payload.revisedDeviceMake);
  const model = str(payload.revisedDeviceModel);
  const storage = str(payload.revisedDeviceStorage) ?? "";
  if (!make || !model) {
    return { error: "Revised device make and model are required" };
  }
  return {
    fields: {
      revisedDeviceId: id,
      revisedDeviceMake: make,
      revisedDeviceModel: model,
      revisedDeviceStorage: storage,
    },
  };
}

/**
 * A late arrival can't be inspected until an admin has checked the first-scan
 * date and recorded on time, honour or reassess (D2, terms §5).
 */
function lateDecisionFields(
  q: QuoteData,
  payload: Record<string, unknown>
): { error: string } | { fields: Record<string, unknown> } {
  if (q.lateArrival !== true || q.lateDecision) return { fields: {} };
  if (!isLateDecision(payload.lateDecision)) {
    return {
      error:
        "This device arrived late. Check the first-scan date in tracking, then choose on time, honour or reassess",
    };
  }
  return {
    fields: {
      lateDecision: payload.lateDecision,
      lateDecisionNote: str(payload.lateDecisionNote),
    },
  };
}

function inspectionGrade(payload: Record<string, unknown>): string | null {
  const grade = str(payload.inspectionGrade);
  return grade ? grade.toUpperCase() : null;
}

// ---------------------------------------------------------------------------
// Shared apply steps
// ---------------------------------------------------------------------------

function applyAccept(q: QuoteData, ctx: TransitionContext): ApplyResult {
  if (isModeC(q)) return applyAcceptModeC(q, ctx);
  const p = ctx.payload ?? {};
  const modeB = isModeB(q);

  // RHEX pays the Mode B partner, never its customer
  if (modeB && hasPaymentFields(p)) {
    return {
      error:
        "Payment details aren't accepted for this quote: RHEX pays the partner, not the customer",
    };
  }

  // Payload values win; admins may accept using details already on the quote
  const resolve = (field: string) => str(p[field]) ?? str(q[field]);
  const customerName = resolve("customerName");
  const customerEmail = resolve("customerEmail");
  const customerPhone = resolve("customerPhone");
  const paymentMethod = resolve("paymentMethod");

  // The website and admin send an Australian address in parts; the v1 API
  // still sends one line (Mode A/B review)
  let shippingAddress: string | null;
  let shippingAddressParts: AuAddress | null = null;
  if (p.shippingAddressParts !== undefined) {
    const parsed = parseAuAddress(p.shippingAddressParts);
    if (!parsed.ok) return { error: parsed.error };
    shippingAddressParts = parsed.address;
    shippingAddress = formatAuAddress(parsed.address);
  } else if (ctx.actor === "customer") {
    return { error: "Enter your shipping address" };
  } else {
    shippingAddress = resolve("shippingAddress");
  }

  // Mode B customer contact is optional reference data
  if (
    !modeB &&
    (!customerName ||
      !customerEmail ||
      !customerPhone ||
      !shippingAddress ||
      !paymentMethod)
  ) {
    return {
      error:
        "customerName, customerEmail, customerPhone, shippingAddress, and paymentMethod are required",
    };
  }

  const fields: Record<string, unknown> = {};
  if (customerName) fields.customerName = customerName;
  if (customerEmail) fields.customerEmail = customerEmail;
  if (customerPhone) fields.customerPhone = customerPhone;
  if (shippingAddress) fields.shippingAddress = shippingAddress;
  if (shippingAddressParts) fields.shippingAddressParts = shippingAddressParts;

  if (paymentMethod) {
    if (paymentMethod !== "payid" && paymentMethod !== "bank_transfer") {
      return { error: "paymentMethod must be 'payid' or 'bank_transfer'" };
    }
    fields.paymentMethod = paymentMethod;
    if (paymentMethod === "payid") {
      const payIdPhone = resolve("payIdPhone");
      if (!payIdPhone) {
        return { error: "payIdPhone is required for PayID payment method" };
      }
      fields.payIdPhone = payIdPhone;
    } else {
      const bankBSB = resolve("bankBSB");
      const bankAccountNumber = resolve("bankAccountNumber");
      const bankAccountName = resolve("bankAccountName");
      if (!bankBSB || !bankAccountNumber || !bankAccountName) {
        return {
          error:
            "bankBSB, bankAccountNumber, and bankAccountName are required for bank transfer",
        };
      }
      Object.assign(fields, { bankBSB, bankAccountNumber, bankAccountName });
    }
  }

  if (ctx.actor === "customer") {
    if (p.termsAccepted !== true) {
      return { error: "You must accept the Trade-In Terms & Conditions" };
    }
    fields.termsAcceptedAt = ctx.now;
    fields.termsVersion = TRADEIN_TERMS_VERSION;
  }

  // Accept IMEI if provided and the quote doesn't already have one
  const imei = str(p.imei);
  if (imei && /^\d{15}$/.test(imei) && !q.imei) {
    fields.imei = imei;
  }

  const effects: SideEffect[] = ["link_customer"];
  // Admin accepts send no email (unchanged from before the module)
  if (ctx.actor !== "admin") effects.push("accepted_email");
  return { fields, effects };
}

/**
 * Mode C acceptance, sent by the partner at checkout: the customer's contact
 * details, AU address and consent to RHEX's trade-in terms. RHEX is the
 * buyer but the partner refunds the customer, so payout details are refused.
 * Admins may accept using details already on the quote, without consent.
 */
function applyAcceptModeC(q: QuoteData, ctx: TransitionContext): ApplyResult {
  const p = ctx.payload ?? {};
  if (hasPaymentFields(p)) {
    return {
      error:
        "Payment details aren't accepted for this quote: the partner refunds the customer",
    };
  }

  const resolve = (field: string) => str(p[field]) ?? str(q[field]);
  const firstName = resolve("customerFirstName");
  const lastName = resolve("customerLastName");
  const email = resolve("customerEmail");
  const phone = resolve("customerPhone");
  const rawAddress =
    p.shippingAddressParts ??
    (p.shippingAddress && typeof p.shippingAddress === "object"
      ? p.shippingAddress
      : undefined) ??
    q.shippingAddressParts;

  if (!firstName || !lastName || !email || !phone || !rawAddress) {
    return {
      error:
        "customerFirstName, customerLastName, customerEmail, customerPhone and shippingAddress are required",
    };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "customerEmail is not a valid email address" };
  }
  const address = parseAuAddress(rawAddress);
  if (!address.ok) return { error: `shippingAddress: ${address.error}` };

  if (
    p.marketingConsent !== undefined &&
    typeof p.marketingConsent !== "boolean"
  ) {
    return { error: "marketingConsent must be true or false" };
  }
  const marketingConsent = p.marketingConsent === true;

  const fields: Record<string, unknown> = {
    customerFirstName: firstName,
    customerLastName: lastName,
    customerName: `${firstName} ${lastName}`,
    customerEmail: email,
    customerPhone: phone,
    shippingAddress: formatAuAddress(address.address),
    shippingAddressParts: address.address,
    marketingConsent,
    marketingConsentAt: marketingConsent ? ctx.now : null,
    // The trade-in keeps the label terms it was accepted under
    labelArrangement: ctx.labelArrangement ?? REFLOW_LABELS,
  };

  if (ctx.actor !== "admin") {
    if (p.termsAccepted !== true) {
      return {
        error:
          "termsAccepted must be true: the customer must accept the Trade-In Terms & Conditions",
      };
    }
    if (p.termsVersion !== TRADEIN_TERMS_VERSION) {
      return {
        error: `termsVersion must be "${TRADEIN_TERMS_VERSION}", the current Trade-In Terms & Conditions`,
      };
    }
    fields.termsAcceptedAt = ctx.now;
    fields.termsVersion = TRADEIN_TERMS_VERSION;
  }

  const imei = str(p.imei);
  if (imei && /^\d{15}$/.test(imei) && !q.imei) fields.imei = imei;

  const effects: SideEffect[] = ["link_customer"];
  if (ctx.actor !== "admin") effects.push("accepted_email");
  return { fields, effects };
}

function applyReceive(q: QuoteData, ctx: TransitionContext): ApplyResult {
  const p = ctx.payload ?? {};
  const imei = str(p.imei);
  const serialNumber = str(p.serialNumber);

  if (imei && !/^\d{15}$/.test(imei)) {
    return { error: "IMEI must be 15 digits" };
  }
  if (!imei && !serialNumber) {
    return { error: "Enter the device's IMEI or serial number" };
  }

  const fields: Record<string, unknown> = {};
  if (imei) {
    fields.receivedImei = imei;
    if (!q.imei) fields.imei = imei;
  }
  if (serialNumber) fields.receivedSerial = serialNumber;

  if (q.status === "expired" || isPast(q.expectedByAt, ctx.now)) {
    fields.lateArrival = true;
  }
  return withModeCEmail({ fields }, q, "received_email");
}

function applyCancel(q: QuoteData, ctx: TransitionContext): ApplyResult {
  const code = str(ctx.payload?.cancelReason);
  if (!code || !(CANCEL_REASONS as readonly string[]).includes(code)) {
    return { error: "A cancellation reason is required" };
  }
  const cancelReason = code as CancelReason;
  const fromHold = q.status === "on_hold";

  if (fromHold && cancelReason !== "surrendered") {
    return {
      error:
        "A quote on hold can only be cancelled when the device is surrendered to authorities",
    };
  }
  if (!fromHold && cancelReason === "surrendered") {
    return { error: "Only a quote on hold can be cancelled as surrendered" };
  }

  const note = str(ctx.reason);
  if (cancelReason === "other" && !note) {
    return { error: "A note is required when the reason is 'other'" };
  }

  return withCustomerValue(
    { fields: { cancelReason, cancelNote: note } },
    q,
    "reverse_customer_value"
  );
}

/** An unused label goes to the refund queue when its quote ends before shipping. */
function withLabelRefund(result: ApplyResult, q: QuoteData): ApplyResult {
  if ("error" in result || !q.labelId) return result;
  return {
    ...result,
    effects: [...(result.effects ?? []), "queue_label_refund"],
  };
}

/** Mode C customers get emails consumer quotes don't (docs/partners/OPPO.md, 2b). */
function withModeCEmail(
  result: ApplyResult,
  q: QuoteData,
  effect: "received_email" | "returning_email"
): ApplyResult {
  if ("error" in result || !isModeC(q)) return result;
  return { ...result, effects: [...(result.effects ?? []), effect] };
}

/**
 * Mode C: the customer is told when their trade-in is cancelled before the
 * device arrives, unless it was fake, a duplicate or (on hold) surrendered.
 */
const EMAILED_CANCEL_REASONS: readonly CancelReason[] = [
  "customer_request",
  "lost_in_transit",
  "other",
];

function withCancelEmail(result: ApplyResult, q: QuoteData): ApplyResult {
  if ("error" in result || !isModeC(q)) return result;
  const reason = result.fields.cancelReason as CancelReason;
  if (!EMAILED_CANCEL_REASONS.includes(reason)) return result;
  return { ...result, effects: [...(result.effects ?? []), "cancelled_email"] };
}

/** A linked customer's totalValueNZD drops when their quote ends unpaid. */
function withCustomerValue(
  result: ApplyResult,
  q: QuoteData,
  effect: "reverse_customer_value" | "restore_customer_value"
): ApplyResult {
  if ("error" in result || !q.customerId) return result;
  return { ...result, effects: [...(result.effects ?? []), effect] };
}

function applyHold(q: QuoteData, ctx: TransitionContext): ApplyResult {
  const reason = str(ctx.reason);
  if (!reason) return { error: "A reason is required to put a quote on hold" };
  return { fields: { heldFrom: q.status, holdReason: reason } };
}

function applyRelease(_q: QuoteData, ctx: TransitionContext): ApplyResult {
  const note = str(ctx.reason);
  if (!note) return { error: "A release note is required" };
  return { fields: { releaseNote: note } };
}

function applyAdminReturn(q: QuoteData, ctx: TransitionContext): ApplyResult {
  const reason = str(ctx.reason);
  if (!reason) return { error: "A reason is required to return the device" };
  return withModeCEmail({ fields: { returnReason: reason } }, q, "returning_email");
}

/**
 * returning → returned: the customer is emailed, with the return tracking
 * number if given. A tracking number or cost records Reflow's return label;
 * a label the partner made was recorded when staff uploaded it.
 */
function applyReturned(q: QuoteData, ctx: TransitionContext): ApplyResult {
  if (typeof q.returnLabelId === "string") {
    return withCustomerValue(
      { fields: {}, effects: ["returned_email"] },
      q,
      "reverse_customer_value"
    );
  }
  const p = ctx.payload ?? {};
  const tracking = str(p.returnTrackingNumber);
  const trackingNumber = tracking ? tracking.replace(/\s/g, "").toUpperCase() : null;
  let costAUD: number | null = null;
  if (p.returnLabelCostAUD !== undefined && p.returnLabelCostAUD !== null && p.returnLabelCostAUD !== "") {
    costAUD = Number(p.returnLabelCostAUD);
    if (!Number.isFinite(costAUD) || costAUD < 0) {
      return { error: "Return label cost must be a positive number" };
    }
  }
  return withCustomerValue(
    {
      fields: { returnTrackingNumber: trackingNumber },
      effects: ["returned_email"],
      returnLabel:
        trackingNumber || costAUD !== null ? { trackingNumber, costAUD } : undefined,
    },
    q,
    "reverse_customer_value"
  );
}

/** received → inspected: pays the original quote (D12). */
function applyInspectAtOriginal(
  q: QuoteData,
  ctx: TransitionContext
): ApplyResult {
  const p = ctx.payload ?? {};
  const grade = inspectionGrade(p);
  if (!grade) return { error: "inspectionGrade is required" };
  const late = lateDecisionFields(q, p);
  if ("error" in late) return late;
  if (p.revisedPriceNZD !== undefined && p.revisedPriceNZD !== null) {
    return {
      error:
        "An inspection at the original quote can't have a revised price; send a revised offer instead",
    };
  }
  const device = revisedDeviceFields(p);
  if ("error" in device) return device;
  return { fields: { inspectionGrade: grade, ...late.fields, ...device.fields } };
}

/** received → revised: revisions only go down (D12). */
function applyRevise(q: QuoteData, ctx: TransitionContext): ApplyResult {
  const p = ctx.payload ?? {};
  const grade = inspectionGrade(p);
  if (!grade) return { error: "inspectionGrade is required" };
  const late = lateDecisionFields(q, p);
  if ("error" in late) return late;

  const price =
    typeof p.revisedPriceNZD === "string"
      ? Number(p.revisedPriceNZD)
      : p.revisedPriceNZD;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return { error: "revisedPriceNZD is required" };
  }
  if (price >= Number(q.quotePriceNZD ?? 0)) {
    return {
      error:
        "A revised price must be below the original quote. If the device is as good or better, confirm at the original quote.",
    };
  }

  const device = revisedDeviceFields(p);
  if ("error" in device) return device;

  // The customer sees the offer in their currency at the quote's locked FX
  // rate (D6), rounded like the original, so it must be lower there too
  const revisedPriceNZD = Math.round(price * 100) / 100;
  const revisedPriceDisplay = toQuoteCurrency(q, revisedPriceNZD);
  const original = originalAmount(q);
  if (
    revisedPriceDisplay !== null &&
    original.currency !== "NZD" &&
    revisedPriceDisplay >= original.amount
  ) {
    return {
      error: `At the quote's exchange rate the revised offer is ${formatMoney(revisedPriceDisplay, original.currency)}, which isn't below the original ${formatMoney(original.amount, original.currency)}. Lower the revised price or confirm at the original quote.`,
    };
  }

  const days = ctx.revisionExpiryDays ?? DEFAULT_REVISION_RESPONSE_DAYS;
  return {
    fields: {
      inspectionGrade: grade,
      revisedPriceNZD,
      revisedPriceDisplay,
      revisionExpiresAt: new Date(ctx.now.getTime() + days * DAY_MS),
      ...late.fields,
      ...device.fields,
    },
    effects: ["revised_email"],
  };
}

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

const notExpired = (q: QuoteData, ctx: TransitionContext) =>
  isPast(q.expiresAt, ctx.now) ? "Quote has expired" : null;

const revisionOpen = (q: QuoteData, ctx: TransitionContext) =>
  isPast(q.revisionExpiresAt, ctx.now)
    ? "Revision response period has expired"
    : null;

const heldFrom = (status: QuoteStatus) => (q: QuoteData) =>
  q.heldFrom === status ? null : `Quote was not held from ${status}`;

/**
 * Mode C: once the partner has the final result (e.g. never arrived), the
 * trade-in is over for it, so a device that turns up can't be received
 * against this quote (docs/partners/OPPO.md, 2d).
 */
const noPartnerResult = (q: QuoteData) =>
  isModeC(q) && q.partnerResult
    ? "The partner has already been sent this trade-in's final result, so the device can't be received against it. Contact the customer about a new trade-in, or post the device back."
    : null;

export const TRANSITIONS: readonly Rule[] = [
  {
    from: "quoted",
    to: "accepted",
    actors: ["customer", "apiKey", "admin"],
    state: notExpired,
    apply: applyAccept,
  },
  {
    from: "quoted",
    to: "expired",
    actors: ["system"],
    state: (q, ctx) =>
      isPast(q.expiresAt, ctx.now) ? null : "Quote has not expired",
  },
  { from: "quoted", to: "cancelled", actors: ["admin"], apply: applyCancel },

  {
    from: "accepted",
    to: "shipped",
    actors: ["customer", "admin"],
    state: (q, ctx) =>
      ctx.actor === "customer" && !q.labelSentAt
        ? "Your shipping label hasn't been sent yet"
        : null,
  },
  {
    from: "accepted",
    to: "received",
    actors: ["admin"],
    state: noPartnerResult,
    apply: applyReceive,
  },
  {
    from: "accepted",
    to: "expired",
    actors: ["system"],
    state: (q, ctx) => {
      const postBy = toDate(q.postByAt);
      if (!q.labelSentAt || !postBy) return "No shipping label has been sent";
      const deadline = postBy.getTime() + LATE_EXPIRY_GRACE_DAYS * DAY_MS;
      return deadline <= ctx.now.getTime() ? null : "Quote has not expired";
    },
    apply: (q) =>
      withCustomerValue(
        withLabelRefund({ fields: {}, effects: ["expired_email"] }, q),
        q,
        "reverse_customer_value"
      ),
  },
  {
    from: "accepted",
    to: "cancelled",
    actors: ["admin"],
    apply: (q, ctx) => withCancelEmail(withLabelRefund(applyCancel(q, ctx), q), q),
  },

  {
    from: "shipped",
    to: "received",
    actors: ["admin"],
    state: noPartnerResult,
    apply: applyReceive,
  },
  {
    from: "shipped",
    to: "cancelled",
    actors: ["admin"],
    apply: (q, ctx) => withCancelEmail(applyCancel(q, ctx), q),
  },

  {
    from: "expired",
    to: "received",
    actors: ["admin"],
    state: (q) =>
      q.acceptedAt
        ? noPartnerResult(q)
        : "Only a quote that had been accepted can be received",
    apply: (q, ctx) =>
      withCustomerValue(applyReceive(q, ctx), q, "restore_customer_value"),
  },

  {
    from: "received",
    to: "inspected",
    actors: ["admin"],
    apply: applyInspectAtOriginal,
  },
  { from: "received", to: "revised", actors: ["admin"], apply: applyRevise },
  {
    from: "received",
    to: "returning",
    actors: ["admin"],
    apply: applyAdminReturn,
  },
  { from: "received", to: "on_hold", actors: ["admin"], apply: applyHold },
  { from: "inspected", to: "on_hold", actors: ["admin"], apply: applyHold },

  {
    from: "on_hold",
    to: "received",
    actors: ["admin"],
    state: heldFrom("received"),
    apply: applyRelease,
  },
  {
    from: "on_hold",
    to: "inspected",
    actors: ["admin"],
    state: heldFrom("inspected"),
    apply: applyRelease,
  },
  {
    from: "on_hold",
    to: "returning",
    actors: ["admin"],
    apply: applyAdminReturn,
  },
  { from: "on_hold", to: "cancelled", actors: ["admin"], apply: applyCancel },

  {
    from: "revised",
    to: "inspected",
    actors: ["customer", "partner", "apiKey", "admin"],
    state: (q, ctx) => (ctx.actor === "admin" ? null : revisionOpen(q, ctx)),
    apply: (_q, ctx) => {
      if (ctx.actor === "admin") {
        const check = requireReason(
          ctx,
          "A reason is required to accept a revision on the customer's behalf"
        );
        if ("error" in check) return check;
        return {
          fields: { revisionAcceptedAt: ctx.now, revisionForceAccepted: true },
        };
      }
      return { fields: { revisionAcceptedAt: ctx.now } };
    },
  },
  {
    from: "revised",
    to: "returning",
    actors: ["customer", "partner", "apiKey", "system"],
    state: (q, ctx) => {
      if (ctx.actor === "system") {
        return isPast(q.revisionExpiresAt, ctx.now)
          ? null
          : "Revision response period has not expired";
      }
      return revisionOpen(q, ctx);
    },
    apply: (q, ctx) =>
      withModeCEmail(
        ctx.actor === "system"
          ? { fields: { revisionAutoExpired: true } }
          : { fields: { revisionRejectedAt: ctx.now } },
        q,
        "returning_email"
      ),
  },

  {
    from: "inspected",
    to: "paid",
    actors: ["admin"],
    state: (q) =>
      isModeB(q) || isModeC(q) || hasPayoutDetails(q)
        ? null
        : "Payout details are missing",
    apply: (q, ctx) =>
      // Mode C: approved; the partner refunds the customer (partner_result)
      isModeC(q)
        ? {
            fields: {
              settlement: partnerSettlementSnapshot(q, ctx.now, ctx.actorId ?? null),
            },
            effects: ["approved_email"],
          }
        : {
            fields: { payout: payoutSnapshot(q, ctx.now, ctx.actorId ?? null) },
            effects: ["commission", "paid_email"],
          },
  },
  {
    from: "inspected",
    to: "returning",
    actors: ["admin"],
    apply: applyAdminReturn,
  },

  {
    from: "returning",
    to: "returned",
    actors: ["admin"],
    apply: applyReturned,
  },
];

function findRule(from: QuoteStatus, to: QuoteStatus): Rule | undefined {
  return TRANSITIONS.find((r) => r.from === from && r.to === to);
}

/**
 * Actors a partner mode rules out on top of the table. Mode C quotes are
 * accepted by the partner at checkout, and the customer (not the partner)
 * answers a revised offer.
 */
function modeForbids(q: QuoteData, rule: Rule, actor: QuoteActor): boolean {
  if (!isModeC(q)) return false;
  if (rule.from === "quoted" && rule.to === "accepted") return actor === "customer";
  if (rule.from === "revised") return actor === "partner" || actor === "apiKey";
  return false;
}

function actorAllowed(q: QuoteData, rule: Rule, actor: QuoteActor): boolean {
  return rule.actors.includes(actor) && !modeForbids(q, rule, actor);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Targets the actor may move the quote to, judged on the stored quote only
 * (payload guards such as a required reason are checked on submit).
 */
export function allowedTransitions(
  q: QuoteData,
  actor: QuoteActor,
  now: Date = new Date()
): QuoteStatus[] {
  if (!isQuoteStatus(q.status)) return [];
  const ctx: TransitionContext = { actor, now };
  return TRANSITIONS.filter(
    (r) =>
      r.from === q.status &&
      actorAllowed(q, r, actor) &&
      (!r.state || r.state(q, ctx) === null)
  ).map((r) => r.to);
}

/**
 * The deadline transition now due for a quote, if any: quoted or accepted
 * → expired, or revised → returning. Used by the expiry cron and the check
 * when a quote is opened.
 */
export function dueSystemTransition(
  q: QuoteData,
  now: Date = new Date()
): QuoteStatus | null {
  return allowedTransitions(q, "system", now)[0] ?? null;
}

/**
 * Mode C: whether the re-quote reminder is due, REVISION_REMINDER_HOURS
 * before the revised offer ends. Sent once (`remindersSent.revision`), and
 * not within a day of the offer itself if the response period is short.
 */
export function dueRevisionReminder(q: QuoteData, now: Date = new Date()): boolean {
  if (q.status !== "revised" || !isModeC(q)) return false;
  const expires = toDate(q.revisionExpiresAt);
  if (!expires) return false;
  const left = expires.getTime() - now.getTime();
  if (left <= 0 || left > REVISION_REMINDER_HOURS * 60 * 60 * 1000) return false;
  const revisedAt = toDate(q.revisedAt);
  if (revisedAt && now.getTime() - revisedAt.getTime() < DAY_MS) return false;
  const sent = (q.remindersSent ?? {}) as Record<string, unknown>;
  return !sent.revision;
}

/** Validate a transition and work out what it writes. */
export function planTransition(
  q: QuoteData,
  to: QuoteStatus,
  ctx: TransitionContext
): TransitionPlan {
  const from = q.status;
  if (!isQuoteStatus(from)) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `Current status "${String(from)}" is not recognized`,
    };
  }

  const rule = findRule(from, to);
  if (!rule) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `Cannot move a quote from "${from}" to "${to}"`,
    };
  }
  if (!actorAllowed(q, rule, ctx.actor)) {
    return {
      ok: false,
      code: "forbidden",
      message: `${ctx.actor} cannot move a quote from "${from}" to "${to}"`,
    };
  }

  const stateError = rule.state?.(q, ctx) ?? null;
  if (stateError) {
    return { ok: false, code: "guard_failed", message: stateError };
  }

  const applied = rule.apply ? rule.apply(q, ctx) : { fields: {} };
  if ("error" in applied) {
    return { ok: false, code: "guard_failed", message: applied.error };
  }

  const historyEntry: StatusHistoryEntry = {
    from,
    to,
    actor: ctx.actor,
    actorId: ctx.actorId ?? null,
    at: ctx.now,
    reason: str(ctx.reason),
  };

  const update: Record<string, unknown> = { ...applied.fields, status: to };
  // Keep the first time a status was reached (e.g. received, then on hold, then released)
  const timestampField = STATUS_TIMESTAMP_FIELDS[to];
  if (!q[timestampField]) update[timestampField] = ctx.now;
  const history = Array.isArray(q.statusHistory) ? q.statusHistory : [];
  update.statusHistory = [...history, historyEntry];

  let effects = applied.effects ?? [];
  // Mode B: RHEX deals only with the partner, so nothing reaches its customer
  if (isModeB(q)) effects = effects.filter((e) => !CUSTOMER_EFFECTS.includes(e));

  const partnerResult = isModeC(q)
    ? partnerResultFor({ ...q, ...applied.fields }, from, to, {
        neverArrived: ctx.neverArrivedResult === true,
      })
    : null;
  if (partnerResult) effects = [...effects, "partner_result"];

  const returnTerms = quoteLabelArrangement(q).return;
  const returnLabel: ReturnLabelPlan | null = applied.returnLabel
    ? { ...applied.returnLabel, providedBy: "reflow", paidBy: labelPaidBy(returnTerms, "reflow") }
    : null;

  return {
    ok: true,
    from,
    to,
    update,
    historyEntry,
    effects,
    assignReference: to === "accepted" && !q.tradeInRef,
    partnerResult,
    returnLabel,
  };
}
