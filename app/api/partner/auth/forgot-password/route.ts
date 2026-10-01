import { NextRequest, NextResponse, after } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import PartnerPasswordResetEmail from "@/emails/partner-password-reset";

// ---------------------------------------------------------------------------
// POST /api/partner/auth/forgot-password — Email a password reset link
// ---------------------------------------------------------------------------
// Sent via Resend rather than Firebase's built-in mailer, whose default
// firebaseapp.com sender lands in spam. Always responds with the same
// success message so the endpoint can't be used to probe which emails
// belong to partners.

async function sendPartnerResetEmail(email: string) {
  try {
    const user = await adminAuth.getUserByEmail(email).catch(() => null);
    if (!user || user.disabled) return;

    const snapshot = await adminDb
      .collection("partners")
      .where("authUid", "==", user.uid)
      .limit(1)
      .get();
    if (snapshot.empty) return;

    const partner = snapshot.docs[0].data();
    if (partner.status !== "active") return;

    const resetLink = await adminAuth.generatePasswordResetLink(email);

    await sendEmail({
      to: email,
      subject: "Reset your rhex partner password",
      react: PartnerPasswordResetEmail({
        partnerName: partner.contactPerson || partner.name || "there",
        resetLink,
      }),
    });
  } catch (error) {
    console.error("Error sending partner password reset:", error);
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`ip:${ip}:/api/partner/auth/forgot-password`, 5);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Cap emails per address so the form can't be used to flood an inbox
    const emailRl = await checkRateLimit(`email:${email}:forgot-password`, 3, 15 * 60_000);
    if (emailRl.allowed) {
      // Run after the response so timing doesn't reveal whether the account exists
      after(() => sendPartnerResetEmail(email));
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error handling forgot-password request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
