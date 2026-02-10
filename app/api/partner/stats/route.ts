import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";

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

    // Count quotes by status
    let totalQuotes = 0;
    let activeQuotes = 0;
    let paidQuotes = 0;

    quotesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      totalQuotes++;
      if (
        data.status === "quoted" ||
        data.status === "accepted" ||
        data.status === "shipped" ||
        data.status === "received" ||
        data.status === "inspected"
      ) {
        activeQuotes++;
      }
      if (data.status === "paid") paidQuotes++;
    });

    bulkSnapshot.docs.forEach((doc) => {
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

    quotesSnapshot.docs.forEach((doc) => {
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

    bulkSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      recentItems.push({
        id: doc.id,
        type: "bulkQuote",
        deviceCount: data.items?.length ?? 0,
        totalNZD: data.totalNZD ?? null,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate: () => Date };
    return ts.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
