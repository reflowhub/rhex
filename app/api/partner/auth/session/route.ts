import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

const SESSION_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 14 days (Firebase max)

// ---------------------------------------------------------------------------
// POST /api/partner/auth/session — Create session cookie from ID token
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

    // Verify the ID token first
    await adminAuth.verifyIdToken(idToken);

    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    });

    const response = NextResponse.json({ status: "ok" });
    response.cookies.set("__session", sessionCookie, {
      maxAge: SESSION_EXPIRY_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 401 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/partner/auth/session — Clear session cookie (logout)
// ---------------------------------------------------------------------------

export async function DELETE() {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.set("__session", "", {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
