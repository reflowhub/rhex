import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/admin/devices/[id] — Get a single device by document ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;
    const doc = await adminDb.collection("devices").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error fetching device:", error);
    return NextResponse.json(
      { error: "Failed to fetch device" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/devices/[id] — Update a device
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;
    const body = await request.json();
    const { make, model, storage } = body;

    const docRef = adminDb.collection("devices").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const existingData = doc.data() ?? {};

    const updatedMake = make ?? existingData.make;
    const updatedModel = model ?? existingData.model;
    const updatedStorage = storage ?? existingData.storage;
    const modelStorage = `${updatedModel} ${updatedStorage}`;

    const updateData: Record<string, unknown> = {
      modelStorage,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (make !== undefined) updateData.make = make;
    if (model !== undefined) updateData.model = model;
    if (storage !== undefined) updateData.storage = storage;

    await docRef.update(updateData);

    const updatedDoc = await docRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error("Error updating device:", error);
    return NextResponse.json(
      { error: "Failed to update device" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/devices/[id] — Delete a device and its associated price entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;
    const docRef = adminDb.collection("devices").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Delete the device document
    await docRef.delete();

    // Also delete the corresponding price entry if it exists
    const priceRef = adminDb.doc(`priceLists/FP-2B/prices/${id}`);
    const priceDoc = await priceRef.get();
    if (priceDoc.exists) {
      await priceRef.delete();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting device:", error);
    return NextResponse.json(
      { error: "Failed to delete device" },
      { status: 500 }
    );
  }
}
