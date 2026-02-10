import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
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
// PUT /api/partner/settings — Update contact + payment details only
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Editable contact fields
    if (body.name !== undefined && typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (trimmed.length > 0) updateData.name = trimmed;
    }
    if (
      body.contactEmail !== undefined &&
      typeof body.contactEmail === "string"
    ) {
      const trimmed = body.contactEmail.trim();
      if (trimmed.length > 0) updateData.contactEmail = trimmed;
    }

    // Editable payment fields
    if (body.paymentMethod !== undefined) {
      const valid = ["payid", "bank_transfer"];
      if (valid.includes(body.paymentMethod)) {
        updateData.paymentMethod = body.paymentMethod;
      }
    }
    if (body.payIdPhone !== undefined) {
      updateData.payIdPhone = body.payIdPhone || null;
    }
    if (body.bankBSB !== undefined) {
      updateData.bankBSB = body.bankBSB || null;
    }
    if (body.bankAccountNumber !== undefined) {
      updateData.bankAccountNumber = body.bankAccountNumber || null;
    }
    if (body.bankAccountName !== undefined) {
      updateData.bankAccountName = body.bankAccountName || null;
    }

    await adminDb.collection("partners").doc(partner.id).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating partner settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
