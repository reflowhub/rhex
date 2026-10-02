import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { DEFAULT_REVISION_RESPONSE_DAYS } from "@/lib/quote-transitions";
import {
  MAX_REVISION_RESPONSE_DAYS,
  TRADEIN_SETTINGS_DOC,
  isValidRevisionResponseDays,
} from "@/lib/tradein-settings";

// ---------------------------------------------------------------------------
// GET /api/admin/settings — Read global trade-in settings
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const doc = await adminDb.doc(TRADEIN_SETTINGS_DOC).get();
    const data = doc.data() ?? {};

    return NextResponse.json({
      businessEstimateDiscount: data.businessEstimateDiscount ?? 0,
      revisionResponseDays: isValidRevisionResponseDays(
        data.revisionResponseDays
      )
        ? data.revisionResponseDays
        : DEFAULT_REVISION_RESPONSE_DAYS,
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
// Body: any of { businessEstimateDiscount, revisionResponseDays }

export async function PUT(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { businessEstimateDiscount, revisionResponseDays } = body ?? {};
    const update: Record<string, number> = {};

    if (businessEstimateDiscount !== undefined) {
      if (
        typeof businessEstimateDiscount !== "number" ||
        businessEstimateDiscount < 0 ||
        businessEstimateDiscount > 100
      ) {
        return NextResponse.json(
          { error: "businessEstimateDiscount must be a number between 0 and 100" },
          { status: 400 }
        );
      }
      update.businessEstimateDiscount = businessEstimateDiscount;
    }

    if (revisionResponseDays !== undefined) {
      if (!isValidRevisionResponseDays(revisionResponseDays)) {
        return NextResponse.json(
          {
            error: `revisionResponseDays must be a whole number from 1 to ${MAX_REVISION_RESPONSE_DAYS}`,
          },
          { status: 400 }
        );
      }
      update.revisionResponseDays = revisionResponseDays;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No settings to update" },
        { status: 400 }
      );
    }

    await adminDb.doc(TRADEIN_SETTINGS_DOC).set(update, { merge: true });

    return NextResponse.json(update);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
