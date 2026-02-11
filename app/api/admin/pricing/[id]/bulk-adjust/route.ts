import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { loadPricingSettings, roundPrice } from "@/lib/pricing-settings";
import { readGrades } from "@/lib/grades";

// ---------------------------------------------------------------------------
// POST /api/admin/pricing/[id]/bulk-adjust — Bulk adjust prices
// ---------------------------------------------------------------------------

type Operation = "adjust_percent" | "adjust_dollar" | "set_ratios";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const body = await request.json();
    const { operation, value, deviceIds } = body as {
      operation: Operation;
      value?: number;
      deviceIds: string[];
    };

    if (!operation || !deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return NextResponse.json(
        { error: "operation and deviceIds[] are required" },
        { status: 400 }
      );
    }

    if (
      (operation === "adjust_percent" || operation === "adjust_dollar") &&
      (value === undefined || typeof value !== "number")
    ) {
      return NextResponse.json(
        { error: "value is required for adjust operations" },
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

    const settings = await loadPricingSettings();
    const { rounding, gradeRatios } = settings;

    // Read current prices for all specified devices
    const priceRefs = deviceIds.map((did) =>
      adminDb.doc(`priceLists/${id}/prices/${did}`)
    );
    const priceDocs = await adminDb.getAll(...priceRefs);

    const GRADE_KEYS = ["A", "B", "C", "D", "E"];
    const updates: { ref: FirebaseFirestore.DocumentReference; grades: Record<string, number> }[] = [];

    for (let i = 0; i < priceDocs.length; i++) {
      const doc = priceDocs[i];
      const deviceId = deviceIds[i];
      if (!doc.exists) continue;

      const currentGrades = readGrades(doc.data() as Record<string, unknown>);
      const newGrades: Record<string, number> = {};

      if (operation === "adjust_percent") {
        for (const g of GRADE_KEYS) {
          const current = currentGrades[g] ?? 0;
          newGrades[g] = roundPrice(current * (1 + value! / 100), rounding);
        }
      } else if (operation === "adjust_dollar") {
        for (const g of GRADE_KEYS) {
          const current = currentGrades[g] ?? 0;
          newGrades[g] = roundPrice(current + value!, rounding);
        }
      } else if (operation === "set_ratios") {
        const gradeA = currentGrades["A"] ?? 0;
        newGrades["A"] = gradeA; // Grade A unchanged
        newGrades["B"] = roundPrice(gradeA * (gradeRatios.B / 100), rounding);
        newGrades["C"] = roundPrice(gradeA * (gradeRatios.C / 100), rounding);
        newGrades["D"] = roundPrice(gradeA * (gradeRatios.D / 100), rounding);
        newGrades["E"] = roundPrice(gradeA * (gradeRatios.E / 100), rounding);
      }

      updates.push({
        ref: adminDb.doc(`priceLists/${id}/prices/${deviceId}`),
        grades: newGrades,
      });
    }

    // Write in batches of 200
    const BATCH_SIZE = 200;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const chunk = updates.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();
      for (const { ref, grades } of chunk) {
        batch.set(ref, { grades }, { merge: true });
      }
      await batch.commit();
    }

    return NextResponse.json({
      updated: updates.length,
      operation,
    });
  } catch (error) {
    console.error("Error in bulk adjust:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk adjustment" },
      { status: 500 }
    );
  }
}
