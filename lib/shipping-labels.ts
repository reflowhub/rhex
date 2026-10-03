import { adminDb } from "@/lib/firebase-admin";
import type { AdminSession } from "@/lib/admin-auth";
import { logQuoteAction } from "@/lib/audit-log";
import { deviceLabel, sendQuoteEmail } from "@/lib/quote-email";
import QuoteLabelEmail from "@/emails/quote-label";
import QuoteLabelReminderEmail from "@/emails/quote-label-reminder";
import {
  LABEL_REMINDER_DAYS,
  dueLabelReminder,
  formatCustomerDate,
  labelDeadlines,
  type LabelReminder,
} from "@/lib/label-deadlines";
import { isModeB, toDate, type QuoteData } from "@/lib/quote-transitions";
import {
  labelPaidBy,
  quoteLabelArrangement,
  type LabelParty,
} from "@/lib/partner-config";

// ---------------------------------------------------------------------------
// Shipping labels for trade-in quotes
// ---------------------------------------------------------------------------
// RHEX creates an Australia Post label in the AusPost portal and uploads the
// PDF here. Each label is a `shippingLabels` doc (tracking, cost, refund
// state); the PDF bytes live in `labelBlobs/{labelId}` (Firestore, private,
// served through the Admin SDK). The quote holds its current label's fields.
//
// Each label records its `direction` (inbound or return) and who made and
// pays for it (`providedBy`, `paidBy`: OPPO.md, 2e). Labels from before
// these fields are inbound, made and paid by Reflow. A Mode C partner may
// make the inbound label (tracking only: the partner sends it) or the
// return label (PDF and tracking: Reflow posts the device).
//
// refundState: "none" while the label may still be used; "pending" once it
// should be refunded (replaced, or its quote expired / was cancelled before
// shipping); then "refunded" or "not_refundable" (it had been scanned).
// Only inbound labels Reflow made are refunded through AusPost.

/** Firestore docs are limited to 1 MiB; leave room for the other fields. */
export const MAX_LABEL_BYTES = 900 * 1024;

export type LabelRefundState = "none" | "pending" | "refunded" | "not_refundable";

export type LabelResult =
  | { ok: true; labelId: string }
  | { ok: false; status: number; error: string };

/** Whether a stored label goes through Reflow's AusPost refunds. */
function refundable(label: Record<string, unknown> | undefined): boolean {
  return (
    !!label &&
    label.sandbox !== true &&
    label.providedBy !== "partner" &&
    label.direction !== "return"
  );
}

interface InboundLabelInput {
  providedBy: LabelParty;
  pdf: Buffer | null;
  fileName: string | null;
  trackingNumber: string;
  carrier: string;
  labelCostAUD: number | null;
  /** Admin email or `apiKey:{id}` */
  sentBy: string;
  /** The label being replaced; must match the quote's current label */
  replaceLabelId: string | null;
  /**
   * Sent with the partner's v1 key: the same tracking number again changes
   * nothing, and errors are worded for the partner
   */
  viaApi?: boolean;
}

type InboundOutcome =
  | { ok: false; status: number; error: string }
  | { ok: true; labelId: string; quote: QuoteData; postByAt: Date; unchanged: boolean };

async function writeInboundLabel(
  quoteId: string,
  input: InboundLabelInput
): Promise<InboundOutcome> {
  const quoteRef = adminDb.collection("quotes").doc(quoteId);
  const labelRef = adminDb.collection("shippingLabels").doc();
  const blobRef = adminDb.collection("labelBlobs").doc(labelRef.id);
  const { replaceLabelId } = input;

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(quoteRef);
    if (!snap.exists) {
      return { ok: false as const, status: 404, error: "Quote not found" };
    }
    const q = snap.data()!;
    if (q.status !== "accepted") {
      return {
        ok: false as const,
        status: 409,
        error: "Labels can only be sent while the quote is accepted",
      };
    }
    const terms = quoteLabelArrangement(q).inbound;
    if (input.providedBy === "partner" && terms.providedBy !== "partner") {
      return {
        ok: false as const,
        status: 409,
        error: "Reflow makes the labels for this trade-in",
      };
    }
    const currentLabelId = (q.labelId as string | undefined) ?? null;
    if (
      input.viaApi &&
      currentLabelId &&
      q.labelProvidedBy === input.providedBy &&
      q.trackingNumber === input.trackingNumber
    ) {
      return {
        ok: true as const,
        labelId: currentLabelId,
        quote: q,
        postByAt: toDate(q.postByAt)!,
        unchanged: true,
      };
    }
    if (currentLabelId !== replaceLabelId) {
      return {
        ok: false as const,
        status: 409,
        error: input.viaApi
          ? "This trade-in already has a different label. Contact RHEX to replace it."
          : currentLabelId
            ? "This quote already has a label. Reload and use Replace label."
            : "This quote has no label to replace",
      };
    }
    const replaced = replaceLabelId
      ? (await tx.get(adminDb.collection("shippingLabels").doc(replaceLabelId))).data()
      : undefined;

    const now = new Date();
    const { postByAt, expectedByAt } = labelDeadlines(now);
    const paidBy = labelPaidBy(terms, input.providedBy);

    tx.set(labelRef, {
      quoteId,
      direction: "inbound",
      providedBy: input.providedBy,
      paidBy,
      partnerId: (q.partnerId as string | undefined) ?? null,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      costAUD: input.labelCostAUD,
      fileName: input.fileName,
      size: input.pdf ? input.pdf.length : null,
      sentAt: now,
      sentBy: input.sentBy,
      status: "active",
      refundState: "none" satisfies LabelRefundState,
      // Sandbox labels are test uploads: never queued for an AusPost refund
      sandbox: q.sandbox === true,
    });
    if (input.pdf) {
      tx.set(blobRef, {
        quoteId,
        data: input.pdf,
        contentType: "application/pdf",
        fileName: input.fileName,
        size: input.pdf.length,
        createdAt: now,
      });
    }
    if (replaceLabelId) {
      tx.update(adminDb.collection("shippingLabels").doc(replaceLabelId), {
        status: "replaced",
        replacedAt: now,
        refundState: (refundable(replaced) ? "pending" : "none") satisfies LabelRefundState,
      });
    }
    tx.update(quoteRef, {
      labelId: labelRef.id,
      labelProvidedBy: input.providedBy,
      labelPaidBy: paidBy,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      labelCostAUD: input.labelCostAUD,
      labelSentAt: now,
      postByAt,
      expectedByAt,
      // A new label starts a new post-by period, so reminders start again
      remindersSent: {},
    });

    return { ok: true as const, labelId: labelRef.id, quote: q, postByAt, unchanged: false };
  });
}

/** Upload Reflow's AusPost label and email it to the customer. */
export async function sendQuoteLabel(
  quoteId: string,
  opts: {
    pdf: Buffer;
    fileName: string;
    trackingNumber: string;
    labelCostAUD: number | null;
    admin: AdminSession;
    /** The label being replaced; must match the quote's current label */
    replaceLabelId?: string | null;
  }
): Promise<LabelResult> {
  const replaceLabelId = opts.replaceLabelId ?? null;
  const outcome = await writeInboundLabel(quoteId, {
    providedBy: "reflow",
    pdf: opts.pdf,
    fileName: opts.fileName,
    trackingNumber: opts.trackingNumber,
    carrier: "auspost",
    labelCostAUD: opts.labelCostAUD,
    sentBy: opts.admin.email,
    replaceLabelId,
  });
  if (!outcome.ok) return outcome;

  await logQuoteAction({
    adminUid: opts.admin.uid,
    adminEmail: opts.admin.email,
    quoteId,
    action: replaceLabelId ? "label_replaced" : "label_sent",
    details: {
      labelId: outcome.labelId,
      trackingNumber: opts.trackingNumber,
      replacedLabelId: replaceLabelId,
    },
  });

  // Mode B: RHEX deals only with the partner. Sandbox: test inboxes only.
  const q = outcome.quote;
  if (!isModeB(q) && typeof q.customerEmail === "string") {
    const deviceName = await deviceLabel(q.deviceId);
    const tradeInRef = (q.tradeInRef as string) ?? quoteId.slice(0, 8);
    const to = q.customerEmail;
    await sendQuoteEmail(q, "label", (brand) => ({
      to,
      subject: `Your prepaid shipping label (${tradeInRef})`,
      react: QuoteLabelEmail({
        customerName: (q.customerName as string) ?? "there",
        deviceName,
        tradeInRef,
        trackingNumber: opts.trackingNumber,
        postBy: formatCustomerDate(outcome.postByAt),
        quoteId,
        brand,
      }),
      attachments: [
        { filename: `RHEX-label-${tradeInRef}.pdf`, content: opts.pdf },
      ],
    }));
  }

  return { ok: true, labelId: outcome.labelId };
}

/**
 * Record an inbound label the Mode C partner made and sent the customer
 * (tracking only, no email from RHEX). Starts the post-by period and
 * reminders like Reflow's label. From admin, or the partner's v1 key, for
 * which the same tracking number again changes nothing.
 */
export async function recordPartnerLabel(
  quoteId: string,
  opts: {
    trackingNumber: string;
    carrier?: string;
    labelCostAUD?: number | null;
    admin?: AdminSession;
    apiKeyId?: string;
    replaceLabelId?: string | null;
  }
): Promise<LabelResult & { unchanged?: boolean }> {
  const replaceLabelId = opts.replaceLabelId ?? null;
  const outcome = await writeInboundLabel(quoteId, {
    providedBy: "partner",
    pdf: null,
    fileName: null,
    trackingNumber: opts.trackingNumber,
    carrier: opts.carrier ?? "auspost",
    labelCostAUD: opts.labelCostAUD ?? null,
    sentBy: opts.admin?.email ?? `apiKey:${opts.apiKeyId}`,
    replaceLabelId,
    viaApi: !opts.admin,
  });
  if (!outcome.ok) return outcome;
  if (outcome.unchanged) return { ok: true, labelId: outcome.labelId, unchanged: true };

  await logQuoteAction({
    adminUid: opts.admin?.uid ?? "apiKey",
    adminEmail: opts.admin?.email ?? `apiKey:${opts.apiKeyId}`,
    quoteId,
    action: replaceLabelId ? "partner_label_replaced" : "partner_label_recorded",
    details: {
      labelId: outcome.labelId,
      trackingNumber: opts.trackingNumber,
      replacedLabelId: replaceLabelId,
    },
  });
  return { ok: true, labelId: outcome.labelId };
}

/**
 * Upload the return label a Mode C partner made (PDF and tracking): Reflow
 * prints it and posts the device back. Marking the quote returned then uses
 * this label's tracking number.
 */
export async function recordPartnerReturnLabel(
  quoteId: string,
  opts: {
    pdf: Buffer;
    fileName: string;
    trackingNumber: string;
    labelCostAUD: number | null;
    admin: AdminSession;
    replaceLabelId?: string | null;
  }
): Promise<LabelResult> {
  const quoteRef = adminDb.collection("quotes").doc(quoteId);
  const labelRef = adminDb.collection("shippingLabels").doc();
  const blobRef = adminDb.collection("labelBlobs").doc(labelRef.id);
  const replaceLabelId = opts.replaceLabelId ?? null;

  const outcome = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(quoteRef);
    if (!snap.exists) {
      return { ok: false as const, status: 404, error: "Quote not found" };
    }
    const q = snap.data()!;
    if (q.status !== "returning") {
      return {
        ok: false as const,
        status: 409,
        error: "Return labels can only be added while the device is being returned",
      };
    }
    const terms = quoteLabelArrangement(q).return;
    if (terms.providedBy !== "partner") {
      return {
        ok: false as const,
        status: 409,
        error: "Reflow makes the return label for this trade-in",
      };
    }
    const currentLabelId = (q.returnLabelId as string | undefined) ?? null;
    if (currentLabelId !== replaceLabelId) {
      return {
        ok: false as const,
        status: 409,
        error: currentLabelId
          ? "This quote already has a return label. Reload and use Replace."
          : "This quote has no return label to replace",
      };
    }

    const now = new Date();
    const paidBy = labelPaidBy(terms, "partner");
    tx.set(labelRef, {
      quoteId,
      direction: "return",
      providedBy: "partner",
      paidBy,
      partnerId: (q.partnerId as string | undefined) ?? null,
      carrier: "auspost",
      trackingNumber: opts.trackingNumber,
      costAUD: opts.labelCostAUD,
      fileName: opts.fileName,
      size: opts.pdf.length,
      sentAt: now,
      sentBy: opts.admin.email,
      status: "active",
      refundState: "none" satisfies LabelRefundState,
      sandbox: q.sandbox === true,
    });
    tx.set(blobRef, {
      quoteId,
      data: opts.pdf,
      contentType: "application/pdf",
      fileName: opts.fileName,
      size: opts.pdf.length,
      createdAt: now,
    });
    if (replaceLabelId) {
      tx.update(adminDb.collection("shippingLabels").doc(replaceLabelId), {
        status: "replaced",
        replacedAt: now,
      });
    }
    tx.update(quoteRef, {
      returnLabelId: labelRef.id,
      returnLabelProvidedBy: "partner",
      returnLabelPaidBy: paidBy,
      returnLabelCostAUD: opts.labelCostAUD,
      returnTrackingNumber: opts.trackingNumber,
    });
    return { ok: true as const };
  });
  if (!outcome.ok) return outcome;

  await logQuoteAction({
    adminUid: opts.admin.uid,
    adminEmail: opts.admin.email,
    quoteId,
    action: replaceLabelId ? "return_label_replaced" : "return_label_added",
    details: {
      labelId: labelRef.id,
      trackingNumber: opts.trackingNumber,
      replacedLabelId: replaceLabelId,
    },
  });
  return { ok: true, labelId: labelRef.id };
}

/**
 * Send the label reminder that is due now, if any (day 7 / day 12, see
 * dueLabelReminder). The reminder is recorded in `remindersSent` inside a
 * transaction before the email goes out, so each one is sent at most once.
 */
export async function sendLabelReminder(
  quoteId: string,
  now: Date = new Date()
): Promise<LabelReminder | null> {
  const quoteRef = adminDb.collection("quotes").doc(quoteId);
  const claimed = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(quoteRef);
    if (!snap.exists) return null;
    const q = snap.data()!;
    const reminder = dueLabelReminder(q, now);
    if (!reminder || typeof q.customerEmail !== "string") return null;
    tx.update(quoteRef, { [`remindersSent.${reminder}`]: now });
    return { reminder, q };
  });
  if (!claimed) return null;

  const { reminder, q } = claimed;
  const tradeInRef = (q.tradeInRef as string) ?? quoteId.slice(0, 8);
  const postBy = toDate(q.postByAt)!;
  const final = reminder === `day${LABEL_REMINDER_DAYS[LABEL_REMINDER_DAYS.length - 1]}`;
  // A reminder switched off for a Mode C partner is still recorded as sent
  await sendQuoteEmail(q, "labelReminders", async (brand) => ({
    to: q.customerEmail as string,
    subject: final
      ? `Last reminder: post your trade-in by ${formatCustomerDate(postBy)} (${tradeInRef})`
      : `Reminder: post your trade-in by ${formatCustomerDate(postBy)} (${tradeInRef})`,
    react: QuoteLabelReminderEmail({
      customerName: (q.customerName as string) ?? "there",
      deviceName: await deviceLabel(q.deviceId),
      tradeInRef,
      postBy: formatCustomerDate(postBy),
      quoteId,
      final,
      brand,
      labelFrom: brand && q.labelProvidedBy === "partner" ? brand.name : null,
    }),
  }));
  return reminder;
}

/** Put a quote's current label in the refund queue (quote expired or cancelled). */
export async function queueLabelRefund(labelId: string): Promise<void> {
  const ref = adminDb.collection("shippingLabels").doc(labelId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const label = snap.data();
    if (!refundable(label) || label!.refundState !== "none") return;
    tx.update(ref, {
      refundState: "pending" satisfies LabelRefundState,
      refundQueuedAt: new Date(),
    });
  });
}

/** Resolve a pending refund. */
export async function resolveLabelRefund(
  labelId: string,
  state: "refunded" | "not_refundable",
  adminUser: AdminSession
): Promise<LabelResult> {
  const ref = adminDb.collection("shippingLabels").doc(labelId);
  const outcome = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { ok: false as const, status: 404, error: "Label not found" };
    }
    if (snap.data()?.refundState !== "pending") {
      return {
        ok: false as const,
        status: 409,
        error: "This label isn't waiting for a refund",
      };
    }
    tx.update(ref, {
      refundState: state,
      refundResolvedAt: new Date(),
      refundResolvedBy: adminUser.email,
    });
    return { ok: true as const, quoteId: snap.data()!.quoteId as string };
  });
  if (!outcome.ok) return outcome;

  await logQuoteAction({
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    quoteId: outcome.quoteId,
    action: state === "refunded" ? "label_refunded" : "label_not_refundable",
    details: { labelId },
  });
  return { ok: true, labelId };
}
