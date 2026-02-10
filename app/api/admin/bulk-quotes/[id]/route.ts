import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { onBulkQuotePaid } from "@/lib/commission-trigger";

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

const VALID_TRANSITIONS: Record<string, string[]> = {
  estimated: ["accepted", "cancelled"],
  accepted: ["received", "cancelled"],
  received: ["inspected", "cancelled"],
  inspected: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// GET /api/admin/bulk-quotes/[id] — Get full bulk quote detail
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const quoteDoc = await adminDb.collection("bulkQuotes").doc(id).get();
    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: "Bulk quote not found" },
        { status: 404 }
      );
    }

    const data = quoteDoc.data()!;

    // Fetch device lines
    const devicesSnapshot = await adminDb
      .collection(`bulkQuotes/${id}/devices`)
      .get();

    const devices = devicesSnapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        rawInput: d.rawInput,
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        matchConfidence: d.matchConfidence,
        quantity: d.quantity,
        assumedGrade: d.assumedGrade,
        indicativePriceNZD: d.indicativePriceNZD,
        actualGrade: d.actualGrade ?? null,
        actualPriceNZD: d.actualPriceNZD ?? null,
        inspectionNotes: d.inspectionNotes ?? null,
      };
    });

    return NextResponse.json({
      id: quoteDoc.id,
      businessName: data.businessName,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      type: data.type,
      assumedGrade: data.assumedGrade,
      totalDevices: data.totalDevices,
      totalIndicativeNZD: data.totalIndicativeNZD,
      matchedCount: data.matchedCount ?? 0,
      unmatchedCount: data.unmatchedCount ?? 0,
      status: data.status,
      paymentMethod: data.paymentMethod ?? null,
      payIdPhone: data.payIdPhone ?? null,
      bankBSB: data.bankBSB ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankAccountName: data.bankAccountName ?? null,
      createdAt: serializeTimestamp(data.createdAt),
      acceptedAt: serializeTimestamp(data.acceptedAt),
      receivedAt: serializeTimestamp(data.receivedAt),
      paidAt: serializeTimestamp(data.paidAt),
      devices,
    });
  } catch (error) {
    console.error("Error fetching bulk quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch bulk quote" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/bulk-quotes/[id] — Update bulk quote status
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const quoteDoc = await adminDb.collection("bulkQuotes").doc(id).get();
    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: "Bulk quote not found" },
        { status: 404 }
      );
    }

    const currentStatus = quoteDoc.data()!.status as string;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from '${currentStatus}' to '${status}'`,
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { status };

    // Set timestamps for specific transitions
    if (status === "accepted") {
      updateData.acceptedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (status === "received") {
      updateData.receivedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (status === "paid") {
      updateData.paidAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await adminDb.collection("bulkQuotes").doc(id).update(updateData);

    // Trigger commission if transitioning to "paid"
    if (status === "paid") {
      const freshDoc = await adminDb.collection("bulkQuotes").doc(id).get();
      const freshData = freshDoc.data() as Record<string, unknown>;
      await onBulkQuotePaid(id, freshData).catch((err) =>
        console.error("Commission trigger error:", err)
      );
    }

    // Re-fetch to return updated data
    const updatedDoc = await adminDb.collection("bulkQuotes").doc(id).get();
    const updatedData = updatedDoc.data()!;

    return NextResponse.json({
      id,
      status: updatedData.status,
      businessName: updatedData.businessName,
      totalDevices: updatedData.totalDevices,
      totalIndicativeNZD: updatedData.totalIndicativeNZD,
      createdAt: serializeTimestamp(updatedData.createdAt),
      acceptedAt: serializeTimestamp(updatedData.acceptedAt),
      receivedAt: serializeTimestamp(updatedData.receivedAt),
      paidAt: serializeTimestamp(updatedData.paidAt),
    });
  } catch (error) {
    console.error("Error updating bulk quote:", error);
    return NextResponse.json(
      { error: "Failed to update bulk quote" },
      { status: 500 }
    );
  }
}
