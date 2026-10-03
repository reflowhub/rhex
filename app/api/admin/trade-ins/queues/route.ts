import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { serializeTimestamp } from "@/lib/serialize";
import { toDate } from "@/lib/quote-transitions";
import { daysSince, labelDueAt, REFUND_URGENT_DAYS } from "@/lib/label-deadlines";
import { QUOTE_STATUS_LABELS, isQuoteStatus } from "@/lib/quote-status";
import { quoteLabelArrangement } from "@/lib/partner-config";
import {
  loadDevices,
  loadOpenTradeIns,
  loadPartnerNames,
  summarizeQuote,
} from "@/lib/trade-in-ops";

// ---------------------------------------------------------------------------
// GET /api/admin/trade-ins/queues — Awaiting label, overdue, to return,
// labels to refund
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const now = new Date();

    const [open, pendingLabels, returningSnap] = await Promise.all([
      loadOpenTradeIns(),
      adminDb.collection("shippingLabels").where("refundState", "==", "pending").get(),
      adminDb.collection("quotes").where("status", "==", "returning").get(),
    ]);
    const returning = returningSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

    // Quotes behind pending refunds that aren't already loaded
    const openIds = new Set(open.map((q) => q.id));
    const labelQuoteIds = Array.from(
      new Set(pendingLabels.docs.map((d) => d.data().quoteId as string))
    ).filter((id) => !openIds.has(id));
    const labelQuotes = labelQuoteIds.length
      ? (
          await adminDb.getAll(
            ...labelQuoteIds.map((id) => adminDb.collection("quotes").doc(id))
          )
        )
          .filter((d) => d.exists)
          .map((d) => ({ id: d.id, data: d.data()! }))
      : [];
    const quoteById = new Map(
      [...open, ...labelQuotes, ...returning].map((q) => [q.id, q.data])
    );
    const [devices, partners] = await Promise.all([
      loadDevices([...quoteById.values()]),
      loadPartnerNames([...open, ...returning].map((q) => q.data)),
    ]);

    // Mode C labels are due by the end of the next business day (OPPO.md, 2d),
    // whoever makes them (2e); overdue ones go first, then oldest first
    const awaitingLabel = open
      .filter(({ data }) => data.status === "accepted" && !data.labelId)
      .map(({ id, data }) => {
        const acceptedAt = toDate(data.acceptedAt);
        const dueAt = data.partnerMode === "C" && acceptedAt ? labelDueAt(acceptedAt) : null;
        return {
          ...summarizeQuote(id, data, devices, partners),
          waitingDays: acceptedAt ? daysSince(acceptedAt, now) : null,
          labelDueAt: dueAt ? dueAt.toISOString() : null,
          labelOverdue: dueAt !== null && dueAt <= now,
          labelBy: quoteLabelArrangement(data).inbound.providedBy,
        };
      })
      .sort(
        (a, b) =>
          Number(b.labelOverdue) - Number(a.labelOverdue) ||
          (b.waitingDays ?? 0) - (a.waitingDays ?? 0)
      );

    const overdue = open
      .filter(({ data }) => {
        const expectedBy = toDate(data.expectedByAt);
        return expectedBy !== null && expectedBy < now;
      })
      .map(({ id, data }) => ({
        ...summarizeQuote(id, data, devices, partners),
        daysOverdue: daysSince(toDate(data.expectedByAt)!, now),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Devices to post back; the partner may be making the return label
    const toReturn = returning
      .map(({ id, data }) => {
        const returningAt = toDate(data.returningAt);
        return {
          ...summarizeQuote(id, data, devices, partners),
          returningDays: returningAt ? daysSince(returningAt, now) : null,
          returnLabelBy: quoteLabelArrangement(data).return.providedBy,
          returnLabelReady: typeof data.returnLabelId === "string",
        };
      })
      .sort((a, b) => (b.returningDays ?? 0) - (a.returningDays ?? 0));

    const labelsToRefund = pendingLabels.docs
      .map((doc) => {
        const label = doc.data();
        const quote = quoteById.get(label.quoteId as string);
        const sentAt = toDate(label.sentAt);
        const ageDays = sentAt ? daysSince(sentAt, now) : 0;
        const status = quote?.status;
        return {
          labelId: doc.id,
          quoteId: label.quoteId as string,
          tradeInRef: (quote?.tradeInRef as string) ?? null,
          customerName: (quote?.customerName as string) ?? null,
          trackingNumber: label.trackingNumber as string,
          costAUD: (label.costAUD as number) ?? null,
          sentAt: serializeTimestamp(label.sentAt),
          ageDays,
          urgent: ageDays >= REFUND_URGENT_DAYS,
          reason:
            label.status === "replaced"
              ? "Replaced"
              : isQuoteStatus(status)
              ? QUOTE_STATUS_LABELS[status]
              : "Unknown",
        };
      })
      .sort((a, b) => b.ageDays - a.ageDays);

    return NextResponse.json({ awaitingLabel, overdue, toReturn, labelsToRefund });
  } catch (error) {
    console.error("Error loading trade-in queues:", error);
    return NextResponse.json(
      { error: "Failed to load queues" },
      { status: 500 }
    );
  }
}
