import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/admin/partners/[id]/payouts — List payouts for a partner
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const payoutsSnapshot = await adminDb
      .collection("payouts")
      .where("partnerId", "==", id)
      .orderBy("createdAt", "desc")
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

    return NextResponse.json(payouts);
  } catch (error) {
    console.error("Error fetching partner payouts:", error);
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/partners/[id]/payouts — Create a payout (marks pending
// commission ledger entries as paid)
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reference } = body;

    // Verify partner exists
    const partnerDoc = await adminDb.collection("partners").doc(id).get();
    if (!partnerDoc.exists) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    const partnerData = partnerDoc.data()!;

    // Fetch all pending commission entries
    const pendingSnapshot = await adminDb
      .collection("commissionLedger")
      .where("partnerId", "==", id)
      .where("status", "==", "pending")
      .get();

    if (pendingSnapshot.empty) {
      return NextResponse.json(
        { error: "No pending commission entries to pay out" },
        { status: 400 }
      );
    }

    // Sum up the pending amount
    let totalAmount = 0;
    const ledgerEntryIds: string[] = [];

    pendingSnapshot.docs.forEach((doc) => {
      totalAmount += doc.data().commissionAmount ?? 0;
      ledgerEntryIds.push(doc.id);
    });

    totalAmount = Math.round(totalAmount * 100) / 100;

    // Create payout document
    const payoutData = {
      partnerId: id,
      amount: totalAmount,
      reference: reference || null,
      paymentMethod: partnerData.paymentMethod ?? null,
      ledgerEntryIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const payoutRef = await adminDb.collection("payouts").add(payoutData);

    // Mark all pending ledger entries as paid
    const BATCH_SIZE = 200;
    for (let i = 0; i < ledgerEntryIds.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = ledgerEntryIds.slice(i, i + BATCH_SIZE);
      chunk.forEach((entryId) => {
        const entryRef = adminDb.collection("commissionLedger").doc(entryId);
        batch.update(entryRef, {
          status: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          payoutId: payoutRef.id,
        });
      });
      await batch.commit();
    }

    return NextResponse.json(
      {
        id: payoutRef.id,
        amount: totalAmount,
        ledgerEntryCount: ledgerEntryIds.length,
        reference: reference || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating payout:", error);
    return NextResponse.json(
      { error: "Failed to create payout" },
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
