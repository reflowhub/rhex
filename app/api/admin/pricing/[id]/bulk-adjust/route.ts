import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { loadPricingSettings, roundPrice } from "@/lib/pricing-settings";
import { readGrades } from "@/lib/grades";
import { getCategoryGrades } from "@/lib/categories";
import { logPriceAudit } from "@/lib/audit-log";

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

    // Determine category from the price list doc
    const priceListData = priceListDoc.data()!;
    const category = (priceListData.category as string) ?? "Phone";

    const settings = await loadPricingSettings(category);
    const { rounding, gradeRatios } = settings;

    // Get dynamic grade keys from category
    const categoryGrades = await getCategoryGrades(category);
    const gradeKeys = categoryGrades.length > 0
      ? categoryGrades.map((g) => g.key)
      : ["A", "B", "C", "D", "E"];

    // Read current prices for all specified devices
    const priceRefs = deviceIds.map((did) =>
      adminDb.doc(`priceLists/${id}/prices/${did}`)
    );
    const priceDocs = await adminDb.getAll(...priceRefs);

    const updates: { ref: FirebaseFirestore.DocumentReference; grades: Record<string, number> }[] = [];

    for (let i = 0; i < priceDocs.length; i++) {
      const doc = priceDocs[i];
      const deviceId = deviceIds[i];
      if (!doc.exists) continue;

      const currentGrades = readGrades(doc.data() as Record<string, unknown>);
      const newGrades: Record<string, number> = {};

      if (operation === "adjust_percent") {
        for (const g of gradeKeys) {
          const current = currentGrades[g] ?? 0;
          newGrades[g] = roundPrice(current * (1 + value! / 100), rounding);
        }
      } else if (operation === "adjust_dollar") {
        for (const g of gradeKeys) {
          const current = currentGrades[g] ?? 0;
          newGrades[g] = roundPrice(current + value!, rounding);
        }
      } else if (operation === "set_ratios") {
        const firstGrade = gradeKeys[0];
        const gradeAValue = currentGrades[firstGrade] ?? 0;
        newGrades[firstGrade] = gradeAValue; // First grade unchanged
        for (let gi = 1; gi < gradeKeys.length; gi++) {
          const g = gradeKeys[gi];
          const ratio = gradeRatios[g] ?? 0;
          newGrades[g] = roundPrice(gradeAValue * (ratio / 100), rounding);
        }
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

    // Audit log
    let summary = "";
    if (operation === "adjust_percent") {
      const sign = value! >= 0 ? "+" : "";
      summary = `Adjusted ${updates.length} devices by ${sign}${value}%`;
    } else if (operation === "adjust_dollar") {
      const sign = value! >= 0 ? "+$" : "-$";
      summary = `Adjusted ${updates.length} devices by ${sign}${Math.abs(value!)}`;
    } else if (operation === "set_ratios") {
      summary = `Set grade ratios for ${updates.length} devices`;
    }

    logPriceAudit({
      adminUid: adminUser.uid,
      adminEmail: adminUser.email,
      action: "bulk_adjust",
      priceListId: id,
      category,
      summary,
      details: {
        operation,
        value: value ?? null,
        deviceCount: updates.length,
        deviceIds,
      },
    });

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
