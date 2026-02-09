import { NextRequest, NextResponse } from "next/server";
import { verifyPartnerSession } from "@/lib/partner-auth";

// ---------------------------------------------------------------------------
// GET /api/partner/auth/me — Return current partner's data
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const partner = await verifyPartnerSession(request);

  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(partner);
}
