import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// PATCH /api/admin/devices/[id]/toggle — Toggle device active/inactive
export async function PATCH(
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

    const currentActive = doc.data()?.active !== false;
    const newActive = !currentActive;

    await docRef.update({
      active: newActive,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id, active: newActive });
  } catch (error) {
    console.error("Error toggling device:", error);
    return NextResponse.json(
      { error: "Failed to toggle device" },
      { status: 500 }
    );
  }
}
