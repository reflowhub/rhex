import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/admin/trade-ins/unmatched/[id]/photo — Admin-only parcel photo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const data = (await adminDb.collection("unmatchedParcels").doc(id).get()).data();
    if (!data?.photo) {
      return new NextResponse("Not found", { status: 404 });
    }

    const photo = Buffer.from(data.photo as Uint8Array);
    return new NextResponse(photo, {
      headers: {
        "Content-Type": (data.photoContentType as string) ?? "image/jpeg",
        "Content-Length": String(photo.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error serving parcel photo:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
