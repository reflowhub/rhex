import { NextRequest, NextResponse, after } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import PartnerPayoutDetailsChangedEmail from "@/emails/partner-payout-details-changed";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";

// ---------------------------------------------------------------------------
// GET /api/partner/settings — Return partner settings
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const partnerDoc = await adminDb
      .collection("partners")
      .doc(partner.id)
      .get();
    if (!partnerDoc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = partnerDoc.data()!;

    return NextResponse.json({
      id: partner.id,
      name: data.name ?? "",
      code: data.code ?? "",
      contactEmail: data.contactEmail ?? "",
      modes: data.modes ?? [],
      // Mode A config (read-only)
      commissionModel: data.commissionModel ?? null,
      commissionPercent: data.commissionPercent ?? null,
      commissionFlat: data.commissionFlat ?? null,
      commissionTiers: data.commissionTiers ?? null,
      payoutFrequency: data.payoutFrequency ?? "monthly",
      // Mode B config (read-only)
      partnerRateDiscount: data.partnerRateDiscount ?? null,
      // Currency (read-only)
      currency: data.currency ?? "AUD",
      // Payment (editable)
      paymentMethod: data.paymentMethod ?? null,
      payIdPhone: data.payIdPhone ?? null,
      bankBSB: data.bankBSB ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankAccountName: data.bankAccountName ?? null,
    });
  } catch (error) {
    console.error("Error fetching partner settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/partner/settings — Update payout (bank transfer) details
// ---------------------------------------------------------------------------
// Name and login email are managed by admin. Changing payout details
// requires a fresh ID token (the client re-authenticates with the current
// password) and emails the partner's contact address.

const REAUTH_MAX_AGE_S = 5 * 60;

const BANK_FIELDS = [
  { key: "bankAccountName", label: "Account name" },
  { key: "bankBSB", label: "BSB" },
  { key: "bankAccountNumber", label: "Account number" },
] as const;

function normalize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function digitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}

function maskAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length > 3 ? `••••${digits.slice(-3)}` : "•••";
}

export async function PUT(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const body = await request.json();

    const partnerRef = adminDb.collection("partners").doc(partner.id);
    const partnerDoc = await partnerRef.get();
    if (!partnerDoc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const current = partnerDoc.data()!;

    // Collect bank fields that actually change
    const updateData: Record<string, unknown> = {};
    for (const { key } of BANK_FIELDS) {
      if (body[key] === undefined) continue;
      const next = normalize(body[key]);
      if (next !== normalize(current[key])) updateData[key] = next;
    }

    const bsb = updateData.bankBSB as string | null | undefined;
    const accountNumber = updateData.bankAccountNumber as string | null | undefined;
    const accountName = updateData.bankAccountName as string | null | undefined;

    if (bsb && (!/^[\d\s-]+$/.test(bsb) || (partner.currency === "AUD" && digitCount(bsb) !== 6))) {
      return NextResponse.json({ error: "BSB must be 6 digits" }, { status: 400 });
    }
    if (
      accountNumber &&
      (!/^[\d\s-]+$/.test(accountNumber) ||
        digitCount(accountNumber) < 5 ||
        digitCount(accountNumber) > 17)
    ) {
      return NextResponse.json(
        { error: "Account number must be 5–17 digits" },
        { status: 400 }
      );
    }
    if (accountName && accountName.length > 100) {
      return NextResponse.json(
        { error: "Account name is too long" },
        { status: 400 }
      );
    }

    // Nothing changed — nothing to verify or save
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true });
    }

    // Require a recent re-authentication by this partner's own login
    const idToken = typeof body.idToken === "string" ? body.idToken : "";
    let reauthenticated = false;
    if (idToken) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken, true);
        const authAge = Date.now() / 1000 - decoded.auth_time;
        reauthenticated =
          decoded.uid === partner.authUid && authAge <= REAUTH_MAX_AGE_S;
      } catch {
        reauthenticated = false;
      }
    }
    if (!reauthenticated) {
      return NextResponse.json(
        {
          error: "Please confirm your password to change payout details",
          reauthRequired: true,
        },
        { status: 403 }
      );
    }

    await partnerRef.update({
      ...updateData,
      paymentMethod: "bank_transfer",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify the partner's contact address of the new details
    const contactEmail = current.contactEmail as string | undefined;
    if (contactEmail) {
      const merged = { ...current, ...updateData };
      const changes = BANK_FIELDS.filter(({ key }) => key in updateData).map(
        ({ key, label }) => {
          const value = merged[key] as string | null;
          if (!value) return { label, value: "(removed)" };
          return {
            label,
            value: key === "bankAccountNumber" ? maskAccountNumber(value) : value,
          };
        }
      );
      after(() =>
        sendEmail({
          to: contactEmail,
          subject: "Your rhex payout details were changed",
          react: PartnerPayoutDetailsChangedEmail({
            partnerName: current.contactPerson || current.name || "there",
            changes,
            changedAt: new Date().toLocaleString("en-AU", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: partner.currency === "NZD" ? "Pacific/Auckland" : "Australia/Sydney",
            }),
          }),
        })
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating partner settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
