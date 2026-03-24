import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidateDeviceCache } from "@/lib/device-cache";

// Max 2 MB after base64 encoding (keeps Firestore doc well under 1 MB limit
// since base64 is ~33% larger than binary, we accept up to ~750 KB originals)
const MAX_FILE_SIZE = 750 * 1024;

// ---------------------------------------------------------------------------
// POST /api/admin/devices/[id]/hero-image — Upload hero image as base64
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image must be under 750 KB for hero images" },
        { status: 400 }
      );
    }

    // Verify device exists
    const docRef = adminDb.collection("devices").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Convert to base64 data URL
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Save to Firestore
    await docRef.update({
      heroImage: dataUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    invalidateDeviceCache();

    return NextResponse.json({ heroImage: dataUrl });
  } catch (error) {
    console.error("Hero image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload hero image" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/devices/[id]/hero-image — Remove hero image
// ---------------------------------------------------------------------------

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

    await docRef.update({
      heroImage: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    invalidateDeviceCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Hero image delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete hero image" },
      { status: 500 }
    );
  }
}
