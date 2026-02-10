import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";

// ---------------------------------------------------------------------------
// GET /api/partner/referral/stats — Mode A referral attribution stats
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    // Fetch all Mode A quotes for this partner
    const quotesSnapshot = await adminDb
      .collection("quotes")
      .where("partnerId", "==", partner.id)
      .where("partnerMode", "==", "A")
      .get();

    const bulkSnapshot = await adminDb
      .collection("bulkQuotes")
      .where("partnerId", "==", partner.id)
      .where("partnerMode", "==", "A")
      .get();

    let totalReferrals = 0;
    const byStatus: Record<string, number> = {};

    quotesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      totalReferrals++;
      byStatus[data.status] = (byStatus[data.status] ?? 0) + 1;
    });

    bulkSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      totalReferrals++;
      byStatus[data.status] = (byStatus[data.status] ?? 0) + 1;
    });

    // Commission ledger
    let commissionEarned = 0;
    let commissionPending = 0;

    const ledgerSnapshot = await adminDb
      .collection("commissionLedger")
      .where("partnerId", "==", partner.id)
      .get();

    ledgerSnapshot.docs.forEach((doc) => {
      const entry = doc.data();
      if (entry.status === "paid") {
        commissionEarned += entry.commissionAmount ?? 0;
      } else if (entry.status === "pending") {
        commissionPending += entry.commissionAmount ?? 0;
      }
    });

    return NextResponse.json({
      totalReferrals,
      byStatus,
      commissionEarned,
      commissionPending,
    });
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch referral stats" },
      { status: 500 }
    );
  }
}
