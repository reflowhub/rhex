import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// POST /api/admin/inventory/return — Process a customer return by resetting
// an existing sold inventory item back to "received" status.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { inventoryId, cosmeticGrade, returnReason } = body;

    if (!inventoryId) {
      return NextResponse.json(
        { error: "inventoryId is required" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("inventory").doc(inventoryId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Inventory item not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    if (data.status !== "sold") {
      return NextResponse.json(
        { error: `Item must have status "sold" to process a return (current: ${data.status})` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: "received",
      listed: false,
      sourceType: "return",
      returnReason: returnReason ?? null,
      returnedFromOrderId: body.orderId ?? null,
      returnedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (cosmeticGrade) {
      updateData.cosmeticGrade = cosmeticGrade;
    }
    if (body.batteryHealth != null) {
      updateData.batteryHealth = body.batteryHealth;
    }
    if (body.location !== undefined) {
      updateData.location = body.location || null;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    await docRef.update(updateData);

    return NextResponse.json({
      id: doc.id,
      inventoryId: data.inventoryId,
      status: "received",
    });
  } catch (error) {
    console.error("Error processing return:", error);
    return NextResponse.json(
      { error: "Failed to process return" },
      { status: 500 }
    );
  }
}
