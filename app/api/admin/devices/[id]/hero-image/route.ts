import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidateDeviceCache } from "@/lib/device-cache";
import { randomUUID } from "crypto";

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";

// ---------------------------------------------------------------------------
// Firebase Storage REST API helpers
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string> {
  const credential = admin.app().options.credential;
  if (!credential) throw new Error("No Firebase credential configured");
  const token = await credential.getAccessToken();
  return token.access_token;
}

async function uploadToFirebaseStorage(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
  downloadToken: string
): Promise<string> {
  const accessToken = await getAccessToken();
  const encodedPath = encodeURIComponent(storagePath);

  const res = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?name=${encodedPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": contentType,
        "X-Goog-Meta-firebaseStorageDownloadTokens": downloadToken,
      },
      body: new Uint8Array(buffer),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${err}`);
  }

  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}

async function deleteFromFirebaseStorage(storagePath: string): Promise<void> {
  const accessToken = await getAccessToken();
  const encodedPath = encodeURIComponent(storagePath);

  await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

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
          await deleteFromFirebaseStorage(oldPath);
        }
      } catch {
        // Old file may already be deleted
      }
    }

    // Upload new file
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `devices/${id}/hero_${timestamp}_${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const downloadToken = randomUUID();

    const downloadUrl = await uploadToFirebaseStorage(
      storagePath,
      buffer,
      file.type,
      downloadToken
    );

    // Save to Firestore
    await docRef.update({
      heroImage: downloadUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    invalidateDeviceCache();

    return NextResponse.json({ heroImage: downloadUrl });
  } catch (error) {
    console.error("Hero image upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to upload hero image: ${message}` },
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
          await deleteFromFirebaseStorage(path);
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
