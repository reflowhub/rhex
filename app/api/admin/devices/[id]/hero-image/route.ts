import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidateDeviceCache } from "@/lib/device-cache";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// POST /api/admin/devices/[id]/hero-image — Upload hero image (server-side)
// ---------------------------------------------------------------------------

export async function POST(
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
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be under 10 MB" },
        { status: 400 }
      );
    }

    // Delete old hero image from storage if it exists
    const existingData = doc.data() ?? {};
    if (existingData.heroImage && typeof existingData.heroImage === "string") {
      try {
        const oldPath = extractStoragePath(existingData.heroImage);
        if (oldPath) {
          await adminStorage.bucket().file(oldPath).delete();
        }
      } catch {
        // Old file may already be deleted
      }
    }

    // Upload new file
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `devices/${id}/hero_${timestamp}_${safeName}`;
    const bucket = adminStorage.bucket();
    const gcsFile = bucket.file(storagePath);

    const buffer = Buffer.from(await file.arrayBuffer());
    const downloadToken = randomUUID();

    await gcsFile.save(buffer, {
      contentType: file.type,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    });

    // Build Firebase-style download URL
    const bucketName = bucket.name;
    const encodedPath = encodeURIComponent(storagePath);
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    // Save to Firestore
    await docRef.update({
      heroImage: downloadUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    invalidateDeviceCache();

    return NextResponse.json({ heroImage: downloadUrl });
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

    const data = doc.data() ?? {};
    if (data.heroImage && typeof data.heroImage === "string") {
      try {
        const path = extractStoragePath(data.heroImage);
        if (path) {
          await adminStorage.bucket().file(path).delete();
        }
      } catch {
        // File may already be deleted
      }
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

// ---------------------------------------------------------------------------
// Helper: extract storage path from Firebase download URL
// ---------------------------------------------------------------------------

function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(
      /firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/
    );
    if (match) return decodeURIComponent(match[1]);
    return null;
  } catch {
    return null;
  }
}
