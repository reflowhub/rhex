import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getCategoryGrades } from "@/lib/categories";
import { logPriceAudit } from "@/lib/audit-log";

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

    // Verify price list exists
    const priceListDoc = await adminDb.doc(`priceLists/${id}`).get();
    if (!priceListDoc.exists) {
      return NextResponse.json(
        { error: "Price list not found" },
        { status: 404 }
      );
    }

    // Validate grade keys dynamically from category
    const priceListData = priceListDoc.data()!;
    const category = (priceListData.category as string) ?? "Phone";
    const categoryGrades = await getCategoryGrades(category);
    const validGradeKeys =
      categoryGrades.length > 0
        ? categoryGrades.map((g) => g.key)
        : ["A", "B", "C", "D", "E"];

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

    // Audit log — record per-grade changes
    const changes: { grade: string; old: number; new: number }[] = [];
    for (const key of Object.keys(sanitized)) {
      const oldVal = existingGrades[key] ?? 0;
      const newVal = mergedGrades[key] ?? 0;
      if (oldVal !== newVal) {
        changes.push({ grade: key, old: oldVal, new: newVal });
      }
    }
    if (changes.length > 0) {
      // Look up device name for the summary
      const deviceDoc = await adminDb.doc(`devices/${deviceId}`).get();
      const deviceData = deviceDoc.data();
      const deviceName = deviceData
        ? `${deviceData.make} ${deviceData.model} ${deviceData.storage}`
        : deviceId;
      const changeSummary = changes
        .map((c) => `${c.grade}: $${c.old}→$${c.new}`)
        .join(", ");

      logPriceAudit({
        adminUid: adminUser.uid,
        adminEmail: adminUser.email,
        action: "inline_edit",
        priceListId: id,
        category,
        summary: `${deviceName} — ${changeSummary}`,
        details: { deviceId, deviceName, changes },
      });
    }

    return NextResponse.json({ deviceId, grades: mergedGrades });
  } catch (error) {
    console.error("Error updating price:", error);
    return NextResponse.json(
      { error: "Failed to update price" },
      { status: 500 }
    );
  }
}
