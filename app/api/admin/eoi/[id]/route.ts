import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// PATCH /api/admin/eoi/[id] — Update EOI status
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const validStatuses = ["new", "contacted", "converted", "dismissed"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("partnerEOIs").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "EOI not found" }, { status: 404 });
    }

    await docRef.update({ status });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating EOI:", error);
    return NextResponse.json(
      { error: "Failed to update expression of interest" },
      { status: 500 }
    );
  }
}
