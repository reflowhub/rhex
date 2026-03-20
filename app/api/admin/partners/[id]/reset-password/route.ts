import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// POST /api/admin/partners/[id]/reset-password — Generate temp password
// ---------------------------------------------------------------------------

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";

  // Ensure at least one of each type
  const parts = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)],
  ];

  // Fill remaining with random mix
  const all = upper + lower + digits + special;
  for (let i = parts.length; i < 12; i++) {
    parts.push(all[crypto.randomInt(all.length)]);
  }

  // Shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }

  return parts.join("");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const partnerDoc = await adminDb.collection("partners").doc(id).get();
    if (!partnerDoc.exists) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    const data = partnerDoc.data()!;
    if (!data.authUid) {
      return NextResponse.json(
        { error: "Partner has no linked auth account" },
        { status: 400 }
      );
    }

    const tempPassword = generatePassword();

    await admin.auth().updateUser(data.authUid, {
      password: tempPassword,
    });

    return NextResponse.json({ password: tempPassword });
  } catch (error) {
    console.error("Error resetting partner password:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
