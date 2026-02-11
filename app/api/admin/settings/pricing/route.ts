import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { loadPricingSettings } from "@/lib/pricing-settings";

// GET /api/admin/settings/pricing?category=Phone — Fetch pricing settings
export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? "Phone";

    const settings = await loadPricingSettings(category);
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching pricing settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing settings" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/settings/pricing — Update pricing settings for a category
export async function PUT(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { category, gradeRatios, rounding } = body;
    const cat = category ?? "Phone";

    // Validate gradeRatios
    if (!gradeRatios || typeof gradeRatios !== "object") {
      return NextResponse.json(
        { error: "gradeRatios is required" },
        { status: 400 }
      );
    }

    // Validate each ratio value
    const sanitizedRatios: Record<string, number> = {};
    for (const [key, val] of Object.entries(gradeRatios)) {
      if (typeof val !== "number" || val < 0 || val > 100) {
        return NextResponse.json(
          { error: `gradeRatios.${key} must be a number between 0 and 100` },
          { status: 400 }
        );
      }
      sanitizedRatios[key] = val;
    }

    // Validate rounding
    if (rounding !== 5 && rounding !== 10) {
      return NextResponse.json(
        { error: "rounding must be 5 or 10" },
        { status: 400 }
      );
    }

    const settings = {
      gradeRatios: sanitizedRatios,
      rounding,
    };

    // Write under category key (new format)
    await adminDb
      .doc("settings/pricing")
      .set({ [cat]: settings }, { merge: true });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating pricing settings:", error);
    return NextResponse.json(
      { error: "Failed to update pricing settings" },
      { status: 500 }
    );
  }
}
