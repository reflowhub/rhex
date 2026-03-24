import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// POST /api/admin/auth/firebase-token — Get a Firebase custom token
// Used by admin pages that need client-side Firebase auth (e.g. Storage uploads)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    const customToken = await adminAuth.createCustomToken(admin.uid);
    return NextResponse.json({ token: customToken });
  } catch (error) {
    console.error("Firebase token creation error:", error);
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 }
    );
  }
}
