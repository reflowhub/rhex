import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

const SETTINGS_DOC = "settings/shipping";

// ---------------------------------------------------------------------------
// GET /api/admin/shipping — Get shipping configuration
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const doc = await adminDb.doc(SETTINGS_DOC).get();
  const data = doc.data() ?? {};

  return NextResponse.json({
    rates: data.rates ?? {},
    freeThreshold: data.freeThreshold ?? 0,
    defaultRate: data.defaultRate ?? 10,
  });
}

// ---------------------------------------------------------------------------
// PUT /api/admin/shipping — Update shipping configuration
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const { rates, freeThreshold, defaultRate } = await request.json();

  if (typeof rates !== "object" || rates === null) {
    return NextResponse.json(
      { error: "rates must be an object" },
      { status: 400 }
    );
  }

  const config = {
    rates,
    freeThreshold: freeThreshold ?? 0,
    defaultRate: defaultRate ?? 10,
  };

  await adminDb.doc(SETTINGS_DOC).set(config, { merge: true });

  return NextResponse.json(config);
}
