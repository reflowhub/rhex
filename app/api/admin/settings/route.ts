import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

const SETTINGS_DOC = "settings/trade-in";

// ---------------------------------------------------------------------------
// GET /api/admin/settings — Read global trade-in settings
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const doc = await adminDb.doc(SETTINGS_DOC).get();
    const data = doc.data() ?? {};

    return NextResponse.json({
      businessEstimateDiscount: data.businessEstimateDiscount ?? 0,
    });
  } catch (error) {
    console.error("Error reading settings:", error);
    return NextResponse.json(
      { error: "Failed to read settings" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/settings — Update global trade-in settings
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { businessEstimateDiscount } = body;

    if (
      businessEstimateDiscount === undefined ||
      typeof businessEstimateDiscount !== "number" ||
      businessEstimateDiscount < 0 ||
      businessEstimateDiscount > 100
    ) {
      return NextResponse.json(
        { error: "businessEstimateDiscount must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    await adminDb.doc(SETTINGS_DOC).set(
      { businessEstimateDiscount },
      { merge: true }
    );

    return NextResponse.json({ businessEstimateDiscount });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
