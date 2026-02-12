import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// PUT /api/admin/upsells/[id] — Update upsell product
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;
  const { id } = await params;

  const docRef = adminDb.collection("upsellProducts").doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.description !== undefined) updateData.description = body.description.trim();
  if (body.priceAUD !== undefined) updateData.priceAUD = body.priceAUD;
  if (body.image !== undefined) updateData.image = body.image?.trim() || null;
  if (body.compatibleCategories !== undefined) updateData.compatibleCategories = body.compatibleCategories;
  if (body.active !== undefined) updateData.active = body.active;

  await docRef.update(updateData);

  return NextResponse.json({ id, ...updateData });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/upsells/[id] — Delete upsell product
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;
  const { id } = await params;

  const docRef = adminDb.collection("upsellProducts").doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await docRef.delete();

  return NextResponse.json({ success: true });
}
