import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// PATCH /api/admin/pricing/[id]/prices/[deviceId] — Update grades for a device
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deviceId: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id, deviceId } = await params;

    const body = await request.json();
    const { grades } = body;

    if (!grades || typeof grades !== "object") {
      return NextResponse.json(
        { error: "grades object is required" },
        { status: 400 }
      );
    }

    // Validate grade values
    const validGradeKeys = ["A", "B", "C", "D", "E"];
    const sanitized: Record<string, number> = {};
    for (const [key, val] of Object.entries(grades)) {
      if (!validGradeKeys.includes(key)) {
        return NextResponse.json(
          { error: `Invalid grade key: ${key}` },
          { status: 400 }
        );
      }
      const num = Number(val);
      if (isNaN(num) || num < 0) {
        return NextResponse.json(
          { error: `Grade ${key} must be a non-negative number` },
          { status: 400 }
        );
      }
      sanitized[key] = num;
    }

    // Verify price list exists
    const priceListDoc = await adminDb.doc(`priceLists/${id}`).get();
    if (!priceListDoc.exists) {
      return NextResponse.json(
        { error: "Price list not found" },
        { status: 404 }
      );
    }

    // Read existing price doc (or create if missing)
    const priceRef = adminDb.doc(`priceLists/${id}/prices/${deviceId}`);
    const priceDoc = await priceRef.get();

    const existingGrades: Record<string, number> = {};
    if (priceDoc.exists) {
      const data = priceDoc.data()!;
      if (data.grades && typeof data.grades === "object") {
        for (const [k, v] of Object.entries(
          data.grades as Record<string, unknown>
        )) {
          existingGrades[k] = Number(v);
        }
      }
    }

    // Merge new grades into existing
    const mergedGrades = { ...existingGrades, ...sanitized };

    await priceRef.set({ grades: mergedGrades }, { merge: true });

    return NextResponse.json({ deviceId, grades: mergedGrades });
  } catch (error) {
    console.error("Error updating price:", error);
    return NextResponse.json(
      { error: "Failed to update price" },
      { status: 500 }
    );
  }
}
