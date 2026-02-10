import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminSession {
  uid: string;
  email: string;
}

// ---------------------------------------------------------------------------
// verifyAdminSession — Extract + verify session cookie, check admin claim
// ---------------------------------------------------------------------------

export async function verifyAdminSession(
  request: NextRequest
): Promise<AdminSession | null> {
  try {
    const sessionCookie = request.cookies.get("__admin_session")?.value;
    if (!sessionCookie) return null;

    const decodedClaims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );

    // Check for admin custom claim
    if (!decodedClaims.admin) return null;

    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email ?? "",
    };
  } catch (error) {
    console.error("Admin session verification failed:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// requireAdmin — Returns admin session or 401 response
// ---------------------------------------------------------------------------

export async function requireAdmin(
  request: NextRequest
): Promise<AdminSession | NextResponse> {
  const admin = await verifyAdminSession(request);

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return admin;
}
