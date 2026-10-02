import admin, { adminDb } from "@/lib/firebase-admin";
import type { AdminSession } from "@/lib/admin-auth";
import { logQuoteTransition } from "@/lib/audit-log";
import { onQuotePaid } from "@/lib/commission-trigger";
import { findOrCreateCustomer } from "@/lib/customer-link";
import {
  deliverPartnerNotification,
  queuePartnerResult,
} from "@/lib/partner-notifications";
import { sendQuoteEmail } from "@/lib/quote-email";
import { originalAmount, payableAmount } from "@/lib/quote-money";
import { queueLabelRefund } from "@/lib/shipping-labels";
import { getRevisionResponseDays } from "@/lib/tradein-settings";
import QuoteAcceptedEmail from "@/emails/quote-accepted";
import QuoteExpiredEmail from "@/emails/quote-expired";
import QuotePaidEmail from "@/emails/quote-paid";
import QuoteReturnedEmail from "@/emails/quote-returned";
import QuoteRevisedEmail from "@/emails/quote-revised";
import {
  formatSandboxTradeInRef,
  formatTradeInRef,
  type QuoteActor,
  type QuoteStatus,
} from "@/lib/quote-status";
import {
  isModeC,
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
// change. Sandbox quotes get SBX- references and skip side effects, except
// Mode C sandbox quotes, which run them against test inboxes and the
// partner's staging endpoint (no customer records or commission).

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

export async function transitionQuote(
  quoteId: string,
  to: QuoteStatus,
  opts: TransitionOptions
): Promise<TransitionResult> {
  const ref = adminDb.collection("quotes").doc(quoteId);
  const actorId =
    opts.actor === "admin" ? opts.admin?.email ?? null : opts.actorId ?? null;
  const revisionExpiryDays =
    to === "revised" ? await getRevisionResponseDays() : undefined;

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
      revisionExpiryDays,
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
    const now = plan.historyEntry.at;

    if (plan.assignReference) {
      const counterRef = adminDb.doc(
        sandbox ? "counters/tradeInsSandbox" : "counters/tradeIns"
      );
      const counter = await tx.get(counterRef);
      const n =
        (counter.data()?.nextId as number | undefined) ?? FIRST_TRADE_IN_NUMBER;
      tx.set(counterRef, { nextId: n + 1 }, { merge: true });
      update.tradeInRef = sandbox ? formatSandboxTradeInRef(n) : formatTradeInRef(n);
    }

    // Mode C: queue the final result with the status change, so it can't be lost
    let notificationId: string | null = null;
    if (plan.partnerResult) {
      notificationId = queuePartnerResult(tx, {
        quoteId,
        partnerId: (before.partnerId as string | undefined) ?? null,
        sandbox,
        body: plan.partnerResult,
        from: plan.from,
        to,
        now,
      });
      update.partnerResult = {
        ...plan.partnerResult,
        notificationId,
        status: "pending",
        queuedAt: now,
        updatedAt: now,
      };
    }

    tx.update(ref, update);
    return {
      ok: true as const,
      from: plan.from,
      before,
      update,
      notificationId,
      effects: sandboxEffects(before, plan.effects),
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

  await runSideEffects(
    quoteId,
    quote,
    outcome.effects,
    opts.actor,
    outcome.notificationId
  );

  return { ok: true, from: outcome.from, to, quote };
}

/**
 * Side effects for a sandbox quote: none, except Mode C, whose emails go to
 * test inboxes (lib/quote-email.ts) and whose result goes to the partner's
 * staging endpoint. Sandbox quotes never touch customer records.
 */
function sandboxEffects(q: QuoteData, effects: SideEffect[]): SideEffect[] {
  if (q.sandbox !== true) return effects;
  if (!isModeC(q)) return [];
  return effects.filter(
    (e) =>
      e !== "link_customer" &&
      e !== "commission" &&
      e !== "reverse_customer_value" &&
      e !== "restore_customer_value"
  );
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
  actor: QuoteActor,
  notificationId: string | null
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
            sourcePartnerId: isModeC(quote) ? (quote.partnerId as string) : null,
            marketingConsent: quote.marketingConsent === true,
          });
          // customerValueNZD: what this quote added to the customer's total
          const customerValueNZD = Number(quote.quotePriceNZD ?? 0);
          await ref.update({ customerId, customerValueNZD });
          quote.customerId = customerId;
          quote.customerValueNZD = customerValueNZD;
          break;
        }

        case "accepted_email": {
          if (!customerEmail) break;
          // Customer-priced quotes (public and Mode C, whose customer deals
          // with RHEX); other v1 accepts keep the NZD email
          const isPublic = actor === "customer" || isModeC(quote);
          await sendQuoteEmail(quote, {
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
          // The customer's own quote page (Mode B quotes send no customer email)
          const quoteUrl = `${siteUrl}/sell/quote/${quoteId}`;
          const expiresAt = toDate(quote.revisionExpiresAt) ?? new Date();
          const original = originalAmount(quote);
          const revised = payableAmount(quote);
          await sendQuoteEmail(quote, {
            to: customerEmail,
            subject: "Your trade-in device has been inspected — action required",
            react: QuoteRevisedEmail({
              customerName: (quote.customerName as string) ?? "there",
              deviceName: await deviceLabel(quote.deviceId),
              originalGrade: quote.grade as string,
              revisedGrade: quote.inspectionGrade as string,
              originalPrice: original.amount,
              revisedPrice: revised.amount,
              currency: revised.currency,
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

        case "expired_email": {
          if (!customerEmail) break;
          const tradeInRef =
            (quote.tradeInRef as string | undefined) ?? quoteId.slice(0, 8);
          await sendQuoteEmail(quote, {
            to: customerEmail,
            subject: `Your trade-in has been closed (${tradeInRef})`,
            react: QuoteExpiredEmail({
              customerName: (quote.customerName as string) ?? "there",
              deviceName: await deviceLabel(quote.deviceId),
              tradeInRef,
            }),
          });
          break;
        }

        case "returned_email": {
          if (!customerEmail) break;
          const tradeInRef =
            (quote.tradeInRef as string | undefined) ?? quoteId.slice(0, 8);
          await sendQuoteEmail(quote, {
            to: customerEmail,
            subject: `Your device is on its way back (${tradeInRef})`,
            react: QuoteReturnedEmail({
              customerName: (quote.customerName as string) ?? "there",
              deviceName: await deviceLabel(quote.deviceId),
              tradeInRef,
              trackingNumber: (quote.returnTrackingNumber as string) ?? null,
              shippingAddress: (quote.shippingAddress as string) ?? null,
            }),
          });
          break;
        }

        case "partner_result":
          if (notificationId) await deliverPartnerNotification(notificationId);
          break;

        case "queue_label_refund":
          if (typeof quote.labelId === "string") {
            await queueLabelRefund(quote.labelId);
          }
          break;

        case "reverse_customer_value":
        case "restore_customer_value":
          await adjustCustomerValue(
            quoteId,
            effect === "reverse_customer_value" ? "reverse" : "restore"
          );
          break;

        case "paid_email": {
          if (!customerEmail) break;
          const googlePlaceId = process.env.GOOGLE_PLACE_ID;
          const payable = payableAmount(quote);
          await sendQuoteEmail(quote, {
            to: customerEmail,
            subject: "Payment sent for your trade-in",
            react: QuotePaidEmail({
              customerName: (quote.customerName as string) ?? "there",
              deviceName: await deviceLabel(quote.deviceId),
              finalPrice: payable.amount,
              currency: payable.currency,
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

/**
 * Take a quote's value off its customer's totalValueNZD when it ends unpaid,
 * or add it back if an expired quote is received after all. The quote's
 * `customerValueNZD` records what is currently counted, so each change
 * applies once. Quotes linked before it existed counted quotePriceNZD.
 */
async function adjustCustomerValue(
  quoteId: string,
  direction: "reverse" | "restore"
): Promise<void> {
  const quoteRef = adminDb.collection("quotes").doc(quoteId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(quoteRef);
    const q = snap.data();
    if (!q || typeof q.customerId !== "string" || !q.customerId) return;

    const counted =
      typeof q.customerValueNZD === "number"
        ? q.customerValueNZD
        : Number(q.quotePriceNZD ?? 0);
    const target = direction === "reverse" ? 0 : Number(q.quotePriceNZD ?? 0);
    const delta = target - counted;
    if (delta === 0) return;

    const customerRef = adminDb.collection("customers").doc(q.customerId);
    const customer = await tx.get(customerRef);
    if (customer.exists) {
      tx.update(customerRef, {
        totalValueNZD: admin.firestore.FieldValue.increment(delta),
      });
    }
    tx.update(quoteRef, { customerValueNZD: target });
  });
}
