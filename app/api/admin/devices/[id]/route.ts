import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidateDeviceCache } from "@/lib/device-cache";
import { findDuplicateDevice } from "@/lib/device-uniqueness";
import { getActivePriceList } from "@/lib/categories";

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
    const { make, model, storage, category } = body;

    const docRef = adminDb.collection("devices").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const existingData = doc.data() ?? {};

    const updatedMake = make ?? existingData.make;
    const updatedModel = model ?? existingData.model;
    const updatedStorage = storage ?? existingData.storage;

    // Check for duplicate device (excluding self)
    const duplicate = await findDuplicateDevice(
      updatedMake,
      updatedModel,
      updatedStorage,
      id
    );
    if (duplicate) {
      return NextResponse.json(
        {
          error: `A device with this make/model/storage already exists (${duplicate.make} ${duplicate.model} ${duplicate.storage})`,
        },
        { status: 409 }
      );
    }

    const modelStorage = `${updatedModel} ${updatedStorage}`;

    const updateData: Record<string, unknown> = {
      modelStorage,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (make !== undefined) updateData.make = make;
    if (model !== undefined) updateData.model = model;
    if (storage !== undefined) updateData.storage = storage;
    if (category !== undefined) updateData.category = category;

    await docRef.update(updateData);
    invalidateDeviceCache();

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

    // Look up the device's category to find the correct price list
    const deviceData = doc.data()!;
    const deviceCategory = (deviceData.category as string) ?? "Phone";
    const activePriceListId = await getActivePriceList(deviceCategory);

    // Delete the device document
    await docRef.delete();
    invalidateDeviceCache();

    // Also delete the corresponding price entry if it exists
    if (activePriceListId) {
      const priceRef = adminDb.doc(
        `priceLists/${activePriceListId}/prices/${id}`
      );
      const priceDoc = await priceRef.get();
      if (priceDoc.exists) {
        await priceRef.delete();
      }
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
