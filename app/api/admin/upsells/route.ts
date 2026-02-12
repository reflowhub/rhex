import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// GET /api/admin/upsells — List all upsell products
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const snapshot = await adminDb
    .collection("upsellProducts")
    .orderBy("createdAt", "desc")
    .get();

  const items = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? null,
  }));

  return NextResponse.json(items);
}

// ---------------------------------------------------------------------------
// POST /api/admin/upsells — Create upsell product
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const body = await request.json();
  const { name, description, priceAUD, image, compatibleCategories, active } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (typeof priceAUD !== "number" || priceAUD <= 0) {
    return NextResponse.json(
      { error: "Price must be a positive number" },
      { status: 400 }
    );
  }

  const data = {
    name: name.trim(),
    description: (description ?? "").trim(),
    priceAUD,
    image: image?.trim() || null,
    compatibleCategories: compatibleCategories ?? [],
    active: active ?? true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await adminDb.collection("upsellProducts").add(data);

  return NextResponse.json({ id: docRef.id, ...data }, { status: 201 });
}
