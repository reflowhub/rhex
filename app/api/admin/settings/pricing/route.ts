import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { DEFAULT_PRICING_SETTINGS } from "@/lib/pricing-settings";

// GET /api/admin/settings/pricing — Fetch pricing settings
export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const doc = await adminDb.doc("settings/pricing").get();
    if (!doc.exists) {
      return NextResponse.json(DEFAULT_PRICING_SETTINGS);
    }

    const data = doc.data()!;
    return NextResponse.json({
      gradeRatios: data.gradeRatios ?? DEFAULT_PRICING_SETTINGS.gradeRatios,
      rounding: data.rounding === 10 ? 10 : 5,
    });
  } catch (error) {
    console.error("Error fetching pricing settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing settings" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/settings/pricing — Update pricing settings
export async function PUT(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { gradeRatios, rounding } = body;

    // Validate gradeRatios
    if (!gradeRatios || typeof gradeRatios !== "object") {
      return NextResponse.json(
        { error: "gradeRatios is required" },
        { status: 400 }
      );
    }

    for (const key of ["B", "C", "D", "E"]) {
      const val = gradeRatios[key];
      if (typeof val !== "number" || val < 0 || val > 100) {
        return NextResponse.json(
          { error: `gradeRatios.${key} must be a number between 0 and 100` },
          { status: 400 }
        );
      }
    }

    // Validate rounding
    if (rounding !== 5 && rounding !== 10) {
      return NextResponse.json(
        { error: "rounding must be 5 or 10" },
        { status: 400 }
      );
    }

    const settings = {
      gradeRatios: {
        B: gradeRatios.B,
        C: gradeRatios.C,
        D: gradeRatios.D,
        E: gradeRatios.E,
      },
      rounding,
    };

    await adminDb.doc("settings/pricing").set(settings, { merge: true });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating pricing settings:", error);
    return NextResponse.json(
      { error: "Failed to update pricing settings" },
      { status: 500 }
    );
  }
}
