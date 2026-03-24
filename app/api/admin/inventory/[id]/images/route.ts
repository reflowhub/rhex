import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// POST /api/admin/inventory/[id]/images — Upload image(s) for inventory item
// Stores image as base64 in Firestore imageBlobs collection.
// Returns the public URL(s) at /api/images/[blobId].
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    // Verify inventory item exists
    const invRef = adminDb.collection("inventory").doc(id);
    const invDoc = await invRef.get();
    if (!invDoc.exists) {
      return NextResponse.json(
        { error: "Inventory item not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const urls: string[] = [];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}` },
          { status: 400 }
        );
      }

      // Max 900KB per image (must fit in Firestore 1MB doc limit with metadata)
      if (file.size > 900 * 1024) {
        return NextResponse.json(
          { error: "Each image must be under 900 KB. Compress before uploading." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");

      // Store in imageBlobs collection
      const blobRef = await adminDb.collection("imageBlobs").add({
        data: base64,
        contentType: file.type,
        inventoryId: id,
        fileName: file.name,
        size: file.size,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      urls.push(`/api/images/${blobRef.id}`);
    }

    // Append new URLs to existing images array
    const existingImages = (invDoc.data()?.images as string[]) ?? [];
    const updatedImages = [...existingImages, ...urls];

    await invRef.update({
      images: updatedImages,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ urls, images: updatedImages });
  } catch (error) {
    console.error("Inventory image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload images" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/inventory/[id]/images — Remove an image
// Body: { imageUrl: string }
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl required" },
        { status: 400 }
      );
    }

    // Remove from inventory images array
    const invRef = adminDb.collection("inventory").doc(id);
    const invDoc = await invRef.get();
    if (!invDoc.exists) {
      return NextResponse.json(
        { error: "Inventory item not found" },
        { status: 404 }
      );
    }

    const existingImages = (invDoc.data()?.images as string[]) ?? [];
    const updatedImages = existingImages.filter((url) => url !== imageUrl);

    await invRef.update({
      images: updatedImages,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Delete the blob doc if it's one of ours
    const match = imageUrl.match(/\/api\/images\/(.+)$/);
    if (match) {
      try {
        await adminDb.collection("imageBlobs").doc(match[1]).delete();
      } catch {
        // Blob may already be deleted
      }
    }

    return NextResponse.json({ images: updatedImages });
  } catch (error) {
    console.error("Inventory image delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
