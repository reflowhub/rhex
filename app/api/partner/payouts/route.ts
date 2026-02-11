import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";

// ---------------------------------------------------------------------------
// GET /api/partner/payouts — List payouts for the authenticated partner
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const payoutsSnapshot = await adminDb
      .collection("payouts")
      .where("partnerId", "==", partner.id)
      .get();

    const payouts = payoutsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        amount: data.amount ?? 0,
        reference: data.reference ?? null,
        paymentMethod: data.paymentMethod ?? null,
        ledgerEntryCount: data.ledgerEntryIds?.length ?? 0,
        createdAt: serializeTimestamp(data.createdAt),
      };
    });

    // Sort by date descending
    payouts.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    // Also compute pending balance from commission ledger
    let pendingBalance = 0;
    const ledgerSnapshot = await adminDb
      .collection("commissionLedger")
      .where("partnerId", "==", partner.id)
      .get();

    ledgerSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.status === "pending") {
        pendingBalance += data.commissionAmount ?? 0;
      }
    });

    return NextResponse.json({
      payouts,
      pendingBalance: Math.round(pendingBalance * 100) / 100,
    });
  } catch (error) {
    console.error("Error fetching partner payouts:", error);
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
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
