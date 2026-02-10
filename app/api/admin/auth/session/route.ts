import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------------------------------------------------------------------------
// POST /api/admin/auth/session — Create session cookie from ID token
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json(
        { error: "ID token required" },
        { status: 400 }
      );
    }

    // Verify the ID token and check admin claim
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (!decodedToken.admin) {
      return NextResponse.json(
        { error: "Not an admin user" },
        { status: 403 }
      );
    }

    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    });

    const response = NextResponse.json({ status: "ok" });
    response.cookies.set("__admin_session", sessionCookie, {
      maxAge: SESSION_EXPIRY_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Admin session creation error:", error);
    const msg =
      error instanceof Error ? error.message : "Failed to create session";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/auth/session — Clear session cookie (logout)
// ---------------------------------------------------------------------------

export async function DELETE() {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.set("__admin_session", "", {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
