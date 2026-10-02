import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";
import { serializeTimestamp } from "@/lib/serialize";
import { OPEN_QUOTE_STATUSES, isNotGenuine, isQuoteStatus } from "@/lib/quote-status";

// ---------------------------------------------------------------------------
// GET /api/partner/stats — Dashboard stats for the authenticated partner
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    // Fetch quotes attributed to this partner
    const quotesSnapshot = await adminDb
      .collection("quotes")
      .where("partnerId", "==", partner.id)
      .get();

    // Fetch bulk quotes attributed to this partner
    const bulkSnapshot = await adminDb
      .collection("bulkQuotes")
      .where("partnerId", "==", partner.id)
      .get();

    // Sandbox quotes are excluded from the portal
    const quoteDocs = quotesSnapshot.docs.filter((d) => d.data().sandbox !== true);
    const bulkDocs = bulkSnapshot.docs.filter((d) => d.data().sandbox !== true);

    // Count quotes by status
    let totalQuotes = 0;
    let activeQuotes = 0;
    let paidQuotes = 0;

    quoteDocs.forEach((doc) => {
      const data = doc.data();
      if (isNotGenuine(data)) return;
      totalQuotes++;
      if (isQuoteStatus(data.status) && OPEN_QUOTE_STATUSES.includes(data.status)) {
        activeQuotes++;
      }
      if (data.status === "paid") paidQuotes++;
    });

    bulkDocs.forEach((doc) => {
      const data = doc.data();
      totalQuotes++;
      if (
        data.status === "estimated" ||
        data.status === "accepted" ||
        data.status === "received" ||
        data.status === "inspected"
      ) {
        activeQuotes++;
      }
      if (data.status === "paid") paidQuotes++;
    });

    // Commission ledger summary (Mode A)
    let commissionEarned = 0;
    let pendingPayout = 0;

    if (partner.modes.includes("A")) {
      const ledgerSnapshot = await adminDb
        .collection("commissionLedger")
        .where("partnerId", "==", partner.id)
        .get();

      ledgerSnapshot.docs.forEach((doc) => {
        const entry = doc.data();
        if (entry.status === "paid") {
          commissionEarned += entry.commissionAmount ?? 0;
        } else if (entry.status === "pending") {
          pendingPayout += entry.commissionAmount ?? 0;
        }
      });
    }

    // Recent quotes (last 10) — combine quotes + bulkQuotes, sort by date
    const recentItems: Record<string, unknown>[] = [];

    quoteDocs.forEach((doc) => {
      const data = doc.data();
      recentItems.push({
        id: doc.id,
        type: "quote",
        deviceId: data.deviceId ?? null,
        grade: data.grade ?? null,
        quotePriceNZD: data.quotePriceNZD ?? null,
        status: data.status,
        partnerMode: data.partnerMode ?? null,
        createdAt: serializeTimestamp(data.createdAt),
      });
    });

    bulkDocs.forEach((doc) => {
      const data = doc.data();
      recentItems.push({
        id: doc.id,
        type: "bulkQuote",
        deviceCount: data.totalDevices ?? 0,
        totalNZD: data.revisedTotalNZD ?? data.totalIndicativeNZD ?? null,
        status: data.status,
        partnerMode: data.partnerMode ?? null,
        createdAt: serializeTimestamp(data.createdAt),
      });
    });

    // Sort descending by createdAt, take top 10
    recentItems.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      totalQuotes,
      activeQuotes,
      paidQuotes,
      commissionEarned,
      pendingPayout,
      recentActivity: recentItems.slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching partner stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
