import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// PUT /api/admin/bulk-quotes/[id]/devices/[lineId] — Update device inspection
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id, lineId } = await params;
    const body = await request.json();
    const { actualGrade, actualPriceNZD, inspectionNotes } = body;

    // Validate the bulk quote exists
    const quoteDoc = await adminDb.collection("bulkQuotes").doc(id).get();
    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: "Bulk quote not found" },
        { status: 404 }
      );
    }

    // Validate the device line exists
    const lineDoc = await adminDb
      .doc(`bulkQuotes/${id}/devices/${lineId}`)
      .get();
    if (!lineDoc.exists) {
      return NextResponse.json(
        { error: "Device line not found" },
        { status: 404 }
      );
    }

    // Validate grade
    const validGrades = ["A", "B", "C", "D", "E"];
    if (actualGrade && !validGrades.includes(actualGrade.toUpperCase())) {
      return NextResponse.json(
        { error: "actualGrade must be A, B, C, D, or E" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (actualGrade) {
      updateData.actualGrade = actualGrade.toUpperCase();
    }
    if (actualPriceNZD !== undefined) {
      updateData.actualPriceNZD = Number(actualPriceNZD);
    }
    if (inspectionNotes !== undefined) {
      updateData.inspectionNotes = inspectionNotes;
    }

    await adminDb
      .doc(`bulkQuotes/${id}/devices/${lineId}`)
      .update(updateData);

    // Return the updated line
    const updatedDoc = await adminDb
      .doc(`bulkQuotes/${id}/devices/${lineId}`)
      .get();
    const data = updatedDoc.data()!;

    return NextResponse.json({
      id: lineId,
      rawInput: data.rawInput,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      matchConfidence: data.matchConfidence,
      quantity: data.quantity,
      assumedGrade: data.assumedGrade,
      indicativePriceNZD: data.indicativePriceNZD,
      actualGrade: data.actualGrade ?? null,
      actualPriceNZD: data.actualPriceNZD ?? null,
      inspectionNotes: data.inspectionNotes ?? null,
    });
  } catch (error) {
    console.error("Error updating device inspection:", error);
    return NextResponse.json(
      { error: "Failed to update device inspection" },
      { status: 500 }
    );
  }
}
