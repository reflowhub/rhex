import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// GET /api/admin/auth/me — Return current admin user info
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const admin = await verifyAdminSession(request);

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ email: admin.email });
}
