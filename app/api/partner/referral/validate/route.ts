import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// GET /api/partner/referral/validate?code=X — Validate a referral code
// Returns partner name if code belongs to an active Mode A partner
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`ip:${ip}:/api/partner/referral/validate`, 20);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const code = request.nextUrl.searchParams
      .get("code")
      ?.toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (!code || code.length < 3) {
      return NextResponse.json({ valid: false });
    }

    const snapshot = await adminDb
      .collection("partners")
      .where("code", "==", code)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ valid: false });
    }

    const partner = snapshot.docs[0].data();

    // Must be a Mode A partner
    if (!partner.modes?.includes("A")) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      partnerName: partner.name,
    });
  } catch (error) {
    console.error("Error validating referral code:", error);
    return NextResponse.json({ valid: false });
  }
}
