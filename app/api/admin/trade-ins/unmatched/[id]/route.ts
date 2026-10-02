import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// POST /api/admin/trade-ins/unmatched/[id] — Resolve an unmatched parcel
// ---------------------------------------------------------------------------
// Body: { resolution: string } — what happened (matched to TI-…, returned, …)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;
    const { resolution } = await request.json();

    if (typeof resolution !== "string" || !resolution.trim()) {
      return NextResponse.json(
        { error: "Describe how the parcel was resolved" },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("unmatchedParcels").doc(id);
    const updated = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()?.status !== "open") return false;
      tx.update(ref, {
        status: "resolved",
        resolution: resolution.trim(),
        resolvedAt: new Date(),
        resolvedBy: adminUser.email,
      });
      return true;
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Parcel not found or already resolved" },
        { status: 404 }
      );
    }
    return NextResponse.json({ id });
  } catch (error) {
    console.error("Error resolving unmatched parcel:", error);
    return NextResponse.json(
      { error: "Failed to resolve parcel" },
      { status: 500 }
    );
  }
}
