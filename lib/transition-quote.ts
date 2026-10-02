import { adminDb } from "@/lib/firebase-admin";
import type { AdminSession } from "@/lib/admin-auth";
import { logQuoteTransition } from "@/lib/audit-log";
import { onQuotePaid } from "@/lib/commission-trigger";
import { findOrCreateCustomer } from "@/lib/customer-link";
import { sendEmail } from "@/lib/email";
import { queueLabelRefund } from "@/lib/shipping-labels";
import QuoteAcceptedEmail from "@/emails/quote-accepted";
import QuotePaidEmail from "@/emails/quote-paid";
import QuoteRevisedEmail from "@/emails/quote-revised";
import {
  formatTradeInRef,
  type QuoteActor,
  type QuoteStatus,
} from "@/lib/quote-status";
import {
  planTransition,
  toDate,
  type QuoteData,
  type SideEffect,
  type TransitionErrorCode,
} from "@/lib/quote-transitions";

// ---------------------------------------------------------------------------
// transitionQuote — the only code that changes a single quote's status
// ---------------------------------------------------------------------------
// Re-reads the quote inside a transaction, checks the transition against
// lib/quote-transitions.ts and writes status, timestamp and statusHistory
// together. Side effects run after commit, only for the call that made the
// change. Sandbox quotes skip side effects and TI- references.

const FIRST_TRADE_IN_NUMBER = 1001;

export interface TransitionOptions {
  actor: QuoteActor;
  /** Partner ID or API key ID (admins are identified by `admin`) */
  actorId?: string | null;
  /** Required when actor is "admin" */
  admin?: AdminSession;
  payload?: Record<string, unknown>;
  reason?: string | null;
}

export type TransitionResult =
  | { ok: true; from: QuoteStatus; to: QuoteStatus; quote: QuoteData }
  | {
      ok: false;
      code: TransitionErrorCode | "not_found";
      message: string;
      /** Status at the time of the attempt */
      currentStatus?: unknown;
    };

/** HTTP status for a failed transition. */
export function transitionErrorStatus(
  code: TransitionErrorCode | "not_found"
): number {
  switch (code) {
    case "not_found":
      return 404;
    case "forbidden":
      return 403;
    case "invalid_transition":
      return 409;
    case "guard_failed":
      return 400;
  }
}

function revisionExpiryDays(): number {
  const days = parseInt(process.env.REVISION_EXPIRY_DAYS ?? "14", 10);
  return Number.isFinite(days) && days > 0 ? days : 14;
}

export async function transitionQuote(
  quoteId: string,
  to: QuoteStatus,
  opts: TransitionOptions
): Promise<TransitionResult> {
  const ref = adminDb.collection("quotes").doc(quoteId);
  const actorId =
    opts.actor === "admin" ? opts.admin?.email ?? null : opts.actorId ?? null;

  const outcome = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return {
        ok: false as const,
        code: "not_found" as const,
        message: "Quote not found",
      };
    }
    const before = snap.data()!;

    const plan = planTransition(before, to, {
      actor: opts.actor,
      actorId,
      now: new Date(),
      payload: opts.payload,
      reason: opts.reason,
      revisionExpiryDays: revisionExpiryDays(),
    });
    if (!plan.ok) {
      return {
        ok: false as const,
        code: plan.code,
        message: plan.message,
        currentStatus: before.status,
      };
    }

    const sandbox = before.sandbox === true;
    const update = { ...plan.update };

    if (plan.assignReference && !sandbox) {
      const counterRef = adminDb.doc("counters/tradeIns");
      const counter = await tx.get(counterRef);
      const n =
        (counter.data()?.nextId as number | undefined) ?? FIRST_TRADE_IN_NUMBER;
      tx.set(counterRef, { nextId: n + 1 }, { merge: true });
      update.tradeInRef = formatTradeInRef(n);
    }

    tx.update(ref, update);
    return {
      ok: true as const,
      from: plan.from,
      before,
      update,
      effects: sandbox ? [] : plan.effects,
    };
  });

  if (!outcome.ok) return outcome;

  const quote: QuoteData = { ...outcome.before, ...outcome.update };

  if (opts.actor === "admin" && opts.admin) {
    await logQuoteTransition({
      adminUid: opts.admin.uid,
      adminEmail: opts.admin.email,
      quoteId,
      from: outcome.from,
      to,
      reason: opts.reason ?? null,
      details: opts.payload ?? {},
    });
  }

  await runSideEffects(quoteId, quote, outcome.effects, opts.actor);

  return { ok: true, from: outcome.from, to, quote };
}

// ---------------------------------------------------------------------------
// Side effects
// ---------------------------------------------------------------------------

async function deviceLabel(deviceId: unknown): Promise<string> {
  if (typeof deviceId !== "string" || !deviceId) return "your device";
  const doc = await adminDb.collection("devices").doc(deviceId).get();
  if (!doc.exists) return "your device";
  const d = doc.data()!;
  return `${d.make} ${d.model} ${d.storage}`.trim();
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function runSideEffects(
  quoteId: string,
  quote: QuoteData,
  effects: SideEffect[],
  actor: QuoteActor
): Promise<void> {
  const ref = adminDb.collection("quotes").doc(quoteId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhex.app";
  const customerEmail =
    typeof quote.customerEmail === "string" ? quote.customerEmail : null;

  for (const effect of effects) {
    try {
      switch (effect) {
        case "link_customer": {
          if (!customerEmail) break;
          const paymentMethod = (quote.paymentMethod as string) ?? null;
          const customerId = await findOrCreateCustomer({
            type: "individual",
            name: quote.customerName as string,
            email: customerEmail,
            phone: quote.customerPhone as string,
            shippingAddress: quote.shippingAddress as string,
            paymentMethod: paymentMethod as string,
            payIdPhone:
              paymentMethod === "payid" ? (quote.payIdPhone as string) : null,
            bankBSB:
              paymentMethod === "bank_transfer" ? (quote.bankBSB as string) : null,
            bankAccountNumber:
              paymentMethod === "bank_transfer"
                ? (quote.bankAccountNumber as string)
                : null,
            bankAccountName:
              paymentMethod === "bank_transfer"
                ? (quote.bankAccountName as string)
                : null,
            quoteId,
            quoteValueNZD: Number(quote.quotePriceNZD ?? 0),
          });
          await ref.update({ customerId });
          quote.customerId = customerId;
          break;
        }

        case "accepted_email": {
          if (!customerEmail) break;
          // Public quotes are priced for the customer; v1 keeps its NZD email
          // until the Mode A/B review
          const isPublic = actor === "customer";
          sendEmail({
            to: customerEmail,
            subject: "Your trade-in quote has been accepted",
            react: QuoteAcceptedEmail({
              customerName: quote.customerName as string,
              deviceName: await deviceLabel(quote.deviceId),
              quotePrice: Number(
                isPublic
                  ? quote.quotePriceDisplay ?? quote.quotePriceNZD ?? 0
                  : quote.quotePriceNZD ?? 0
              ),
              currency: isPublic
                ? ((quote.displayCurrency as string) ?? "AUD")
                : "NZD",
              quoteId,
              rhexLabel: isPublic,
            }),
          });
          break;
        }

        case "revised_email": {
          if (!customerEmail) break;
          const revisedDeviceName = quote.revisedDeviceId
            ? `${quote.revisedDeviceMake} ${quote.revisedDeviceModel} ${quote.revisedDeviceStorage}`.trim()
            : undefined;
          const quoteUrl = quote.partnerId
            ? `${siteUrl}/partner/quotes/${quoteId}`
            : `${siteUrl}/sell/quote/${quoteId}`;
          const expiresAt = toDate(quote.revisionExpiresAt) ?? new Date();
          sendEmail({
            to: customerEmail,
            subject: "Your trade-in device has been inspected — action required",
            react: QuoteRevisedEmail({
              customerName: (quote.customerName as string) ?? "there",
              deviceName: await deviceLabel(quote.deviceId),
              originalGrade: quote.grade as string,
              revisedGrade: quote.inspectionGrade as string,
              originalPrice: Number(
                quote.quotePriceDisplay ?? quote.quotePriceNZD ?? 0
              ),
              revisedPrice: Number(quote.revisedPriceNZD ?? 0),
              currency: (quote.displayCurrency as string) ?? "AUD",
              quoteUrl,
              expiresAt: formatLongDate(expiresAt),
              deviceChanged: !!quote.revisedDeviceId,
              revisedDeviceName,
            }),
          });
          break;
        }

        case "commission":
          await onQuotePaid(quoteId, quote);
          break;

        case "queue_label_refund":
          if (typeof quote.labelId === "string") {
            await queueLabelRefund(quote.labelId);
          }
          break;

        case "paid_email": {
          if (!customerEmail) break;
          const googlePlaceId = process.env.GOOGLE_PLACE_ID;
          sendEmail({
            to: customerEmail,
            subject: "Payment sent for your trade-in",
            react: QuotePaidEmail({
              customerName: (quote.customerName as string) ?? "there",
              deviceName: await deviceLabel(quote.deviceId),
              finalPrice: Number(
                quote.revisedPriceNZD ??
                  quote.quotePriceDisplay ??
                  quote.quotePriceNZD ??
                  0
              ),
              currency: (quote.displayCurrency as string) ?? "AUD",
              paymentMethod: (quote.paymentMethod as string) ?? "bank_transfer",
              googleReviewUrl: googlePlaceId
                ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
                : undefined,
              feedbackUrl: `${siteUrl}/feedback/${quoteId}`,
            }),
          });
          break;
        }
      }
    } catch (err) {
      // A failed side effect never undoes the committed transition
      console.error(`Quote ${quoteId} side effect "${effect}" failed:`, err);
    }
  }
}
