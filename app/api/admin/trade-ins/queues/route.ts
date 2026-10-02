import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { serializeTimestamp } from "@/lib/serialize";
import { toDate } from "@/lib/quote-transitions";
import { daysSince, REFUND_URGENT_DAYS } from "@/lib/label-deadlines";
import { QUOTE_STATUS_LABELS, isQuoteStatus } from "@/lib/quote-status";
import { loadDevices, loadOpenTradeIns, summarizeQuote } from "@/lib/trade-in-ops";

// ---------------------------------------------------------------------------
// GET /api/admin/trade-ins/queues — Awaiting label, overdue, labels to refund
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const now = new Date();

    const [open, pendingLabels] = await Promise.all([
      loadOpenTradeIns(),
      adminDb.collection("shippingLabels").where("refundState", "==", "pending").get(),
    ]);

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
      [...open, ...labelQuotes].map((q) => [q.id, q.data])
    );
    const devices = await loadDevices([...quoteById.values()]);

    const awaitingLabel = open
      .filter(({ data }) => data.status === "accepted" && !data.labelId)
      .map(({ id, data }) => ({
        ...summarizeQuote(id, data, devices),
        waitingDays: data.acceptedAt ? daysSince(toDate(data.acceptedAt)!, now) : null,
      }))
      .sort((a, b) => (b.waitingDays ?? 0) - (a.waitingDays ?? 0));

    const overdue = open
      .filter(({ data }) => {
        const expectedBy = toDate(data.expectedByAt);
        return expectedBy !== null && expectedBy < now;
      })
      .map(({ id, data }) => ({
        ...summarizeQuote(id, data, devices),
        daysOverdue: daysSince(toDate(data.expectedByAt)!, now),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

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

    return NextResponse.json({ awaitingLabel, overdue, labelsToRefund });
  } catch (error) {
    console.error("Error loading trade-in queues:", error);
    return NextResponse.json(
      { error: "Failed to load queues" },
      { status: 500 }
    );
  }
}
