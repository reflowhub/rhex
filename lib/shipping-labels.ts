import { adminDb } from "@/lib/firebase-admin";
import type { AdminSession } from "@/lib/admin-auth";
import { logQuoteAction } from "@/lib/audit-log";
import { sendEmail } from "@/lib/email";
import QuoteLabelEmail from "@/emails/quote-label";
import { formatCustomerDate, labelDeadlines } from "@/lib/label-deadlines";

// ---------------------------------------------------------------------------
// Shipping labels for trade-in quotes
// ---------------------------------------------------------------------------
// RHEX creates an Australia Post label in the AusPost portal and uploads the
// PDF here. Each label is a `shippingLabels` doc (tracking, cost, refund
// state); the PDF bytes live in `labelBlobs/{labelId}` (Firestore, private,
// served through the Admin SDK). The quote holds its current label's fields.
//
// refundState: "none" while the label may still be used; "pending" once it
// should be refunded (replaced, or its quote expired / was cancelled before
// shipping); then "refunded" or "not_refundable" (it had been scanned).

/** Firestore docs are limited to 1 MiB; leave room for the other fields. */
export const MAX_LABEL_BYTES = 900 * 1024;

export type LabelRefundState = "none" | "pending" | "refunded" | "not_refundable";

export type LabelResult =
  | { ok: true; labelId: string }
  | { ok: false; status: number; error: string };

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
    if (q.status !== "accepted") {
      return {
        ok: false as const,
        status: 409,
        error: "Labels can only be sent while the quote is accepted",
      };
    }
    const currentLabelId = (q.labelId as string | undefined) ?? null;
    if (currentLabelId !== replaceLabelId) {
      return {
        ok: false as const,
        status: 409,
        error: currentLabelId
          ? "This quote already has a label. Reload and use Replace label."
          : "This quote has no label to replace",
      };
    }

    const now = new Date();
    const { postByAt, expectedByAt } = labelDeadlines(now);

    tx.set(labelRef, {
      quoteId,
      carrier: "auspost",
      trackingNumber: opts.trackingNumber,
      costAUD: opts.labelCostAUD,
      fileName: opts.fileName,
      size: opts.pdf.length,
      sentAt: now,
      sentBy: opts.admin.email,
      status: "active",
      refundState: "none" satisfies LabelRefundState,
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
        refundState: "pending" satisfies LabelRefundState,
      });
    }
    tx.update(quoteRef, {
      labelId: labelRef.id,
      carrier: "auspost",
      trackingNumber: opts.trackingNumber,
      labelCostAUD: opts.labelCostAUD,
      labelSentAt: now,
      postByAt,
      expectedByAt,
    });

    return { ok: true as const, quote: q, postByAt };
  });

  if (!outcome.ok) return outcome;

  await logQuoteAction({
    adminUid: opts.admin.uid,
    adminEmail: opts.admin.email,
    quoteId,
    action: replaceLabelId ? "label_replaced" : "label_sent",
    details: {
      labelId: labelRef.id,
      trackingNumber: opts.trackingNumber,
      replacedLabelId: replaceLabelId,
    },
  });

  const q = outcome.quote;
  if (q.sandbox !== true && typeof q.customerEmail === "string") {
    let deviceName = "your device";
    if (typeof q.deviceId === "string" && q.deviceId) {
      const device = await adminDb.collection("devices").doc(q.deviceId).get();
      if (device.exists) {
        const d = device.data()!;
        deviceName = `${d.make} ${d.model} ${d.storage}`.trim();
      }
    }
    const tradeInRef = (q.tradeInRef as string) ?? quoteId.slice(0, 8);
    await sendEmail({
      to: q.customerEmail,
      subject: `Your prepaid shipping label (${tradeInRef})`,
      react: QuoteLabelEmail({
        customerName: (q.customerName as string) ?? "there",
        deviceName,
        tradeInRef,
        trackingNumber: opts.trackingNumber,
        postBy: formatCustomerDate(outcome.postByAt),
        quoteId,
      }),
      attachments: [
        { filename: `RHEX-label-${tradeInRef}.pdf`, content: opts.pdf },
      ],
    });
  }

  return { ok: true, labelId: labelRef.id };
}

/** Put a quote's current label in the refund queue (quote expired or cancelled). */
export async function queueLabelRefund(labelId: string): Promise<void> {
  const ref = adminDb.collection("shippingLabels").doc(labelId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.refundState !== "none") return;
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
