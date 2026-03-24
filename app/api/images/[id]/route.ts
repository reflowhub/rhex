import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/images/[id] — Serve an image stored in Firestore
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doc = await adminDb.collection("imageBlobs").doc(id).get();
    if (!doc.exists) {
      return new NextResponse("Not found", { status: 404 });
    }

    const data = doc.data()!;
    const base64 = data.data as string;
    const contentType = (data.contentType as string) || "image/jpeg";

    const buffer = Buffer.from(base64, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
