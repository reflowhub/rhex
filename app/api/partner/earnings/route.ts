import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";

// ---------------------------------------------------------------------------
// GET /api/partner/earnings — Commission ledger for Mode A, paid quotes for Mode B
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const items: Record<string, unknown>[] = [];

    if (partner.modes.includes("A")) {
      // Mode A: commission ledger entries
      const ledgerSnapshot = await adminDb
        .collection("commissionLedger")
        .where("partnerId", "==", partner.id)
        .orderBy("createdAt", "desc")
        .get();

      ledgerSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: "commission",
          quoteId: data.quoteId ?? null,
          bulkQuoteId: data.bulkQuoteId ?? null,
          deviceCount: data.deviceCount ?? 0,
          quoteTotal: data.quoteTotal ?? 0,
          commissionAmount: data.commissionAmount ?? 0,
          status: data.status,
          createdAt: serializeTimestamp(data.createdAt),
          paidAt: serializeTimestamp(data.paidAt),
          payoutId: data.payoutId ?? null,
        });
      });
    }

    if (partner.modes.includes("B")) {
      // Mode B: paid quotes (settlements)
      const paidQuotes = await adminDb
        .collection("quotes")
        .where("partnerId", "==", partner.id)
        .where("partnerMode", "==", "B")
        .where("status", "==", "paid")
        .orderBy("createdAt", "desc")
        .get();

      paidQuotes.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: "settlement",
          quotePriceNZD: data.quotePriceNZD ?? 0,
          grade: data.grade ?? null,
          deviceId: data.deviceId ?? null,
          createdAt: serializeTimestamp(data.createdAt),
        });
      });

      // Mode B: paid bulk quotes
      const paidBulk = await adminDb
        .collection("bulkQuotes")
        .where("partnerId", "==", partner.id)
        .where("partnerMode", "==", "B")
        .where("status", "==", "paid")
        .orderBy("createdAt", "desc")
        .get();

      paidBulk.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: "bulkSettlement",
          totalIndicativeNZD: data.totalIndicativeNZD ?? 0,
          totalDevices: data.totalDevices ?? 0,
          createdAt: serializeTimestamp(data.createdAt),
        });
      });
    }

    // Sort by date descending
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
      return dateB - dateA;
    });

    // Compute totals
    let totalCommissionEarned = 0;
    let totalCommissionPending = 0;
    let totalSettled = 0;

    items.forEach((item) => {
      if (item.type === "commission") {
        const amount = Number(item.commissionAmount ?? 0);
        if (item.status === "paid") totalCommissionEarned += amount;
        else if (item.status === "pending") totalCommissionPending += amount;
      } else if (item.type === "settlement") {
        totalSettled += Number(item.quotePriceNZD ?? 0);
      } else if (item.type === "bulkSettlement") {
        totalSettled += Number(item.totalIndicativeNZD ?? 0);
      }
    });

    return NextResponse.json({
      items,
      totalCommissionEarned: Math.round(totalCommissionEarned * 100) / 100,
      totalCommissionPending: Math.round(totalCommissionPending * 100) / 100,
      totalSettled: Math.round(totalSettled * 100) / 100,
    });
  } catch (error) {
    console.error("Error fetching partner earnings:", error);
    return NextResponse.json(
      { error: "Failed to fetch earnings" },
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
