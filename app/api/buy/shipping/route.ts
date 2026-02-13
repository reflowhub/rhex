import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/shop/shipping — Public shipping rates (cached 5 min)
// ---------------------------------------------------------------------------

export async function GET() {
  const doc = await adminDb.doc("settings/shipping").get();
  const data = doc.data() ?? {};

  const response = NextResponse.json({
    rates: data.rates ?? {},
    freeThreshold: data.freeThreshold ?? 0,
    defaultRate: data.defaultRate ?? 10,
  });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );

  return response;
}
