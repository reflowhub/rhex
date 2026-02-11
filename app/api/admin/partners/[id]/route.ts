import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// GET /api/admin/partners/[id] — Get partner detail
// ---------------------------------------------------------------------------

export async function GET(
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

    // Aggregate commission ledger summary for Mode A partners
    let commissionSummary = null;
    if (data.modes?.includes("A")) {
      const ledgerSnapshot = await adminDb
        .collection("commissionLedger")
        .where("partnerId", "==", id)
        .get();

      let totalPending = 0;
      let totalPaid = 0;
      let entryCount = 0;

      ledgerSnapshot.docs.forEach((doc) => {
        const entry = doc.data();
        entryCount++;
        if (entry.status === "pending") {
          totalPending += entry.commissionAmount ?? 0;
        } else if (entry.status === "paid") {
          totalPaid += entry.commissionAmount ?? 0;
        }
      });

      commissionSummary = { totalPending, totalPaid, entryCount };
    }

    const partner = {
      id: partnerDoc.id,
      name: data.name ?? "",
      code: data.code ?? "",
      contactEmail: data.contactEmail ?? "",
      modes: data.modes ?? [],
      status: data.status ?? "inactive",
      authUid: data.authUid ?? null,
      // Mode A
      commissionModel: data.commissionModel ?? null,
      commissionPercent: data.commissionPercent ?? null,
      commissionFlat: data.commissionFlat ?? null,
      commissionTiers: data.commissionTiers ?? null,
      payoutFrequency: data.payoutFrequency ?? "monthly",
      // Mode B
      partnerRateDiscount: data.partnerRateDiscount ?? null,
      // Payment
      paymentMethod: data.paymentMethod ?? null,
      payIdPhone: data.payIdPhone ?? null,
      bankBSB: data.bankBSB ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankAccountName: data.bankAccountName ?? null,
      // Currency
      currency: data.currency ?? "AUD",
      // Contact
      contactPerson: data.contactPerson ?? null,
      contactPhone: data.contactPhone ?? null,
      address: data.address ?? null,
      companyName: data.companyName ?? null,
      companyRegistrationNumber: data.companyRegistrationNumber ?? null,
      // Summary
      commissionSummary,
      // Timestamps
      createdAt: serializeTimestamp(data.createdAt),
      updatedAt: serializeTimestamp(data.updatedAt),
    };

    return NextResponse.json(partner);
  } catch (error) {
    console.error("Error fetching partner:", error);
    return NextResponse.json(
      { error: "Failed to fetch partner" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/partners/[id] — Update partner
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;
    const body = await request.json();

    const partnerRef = adminDb.collection("partners").doc(id);
    const partnerDoc = await partnerRef.get();

    if (!partnerDoc.exists) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Updatable fields
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail.trim();
    if (body.status !== undefined) updateData.status = body.status;

    // Mode updates
    if (body.modes !== undefined && Array.isArray(body.modes) && body.modes.length > 0) {
      const validModes = ["A", "B"];
      updateData.modes = body.modes.filter((m: string) => validModes.includes(m));
    }

    // Code update (check uniqueness if changed)
    if (body.code !== undefined) {
      const normalizedCode = body.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (normalizedCode.length < 3) {
        return NextResponse.json(
          { error: "Code must be at least 3 alphanumeric characters" },
          { status: 400 }
        );
      }
      const currentData = partnerDoc.data()!;
      if (normalizedCode !== currentData.code) {
        const existing = await adminDb
          .collection("partners")
          .where("code", "==", normalizedCode)
          .limit(1)
          .get();
        if (!existing.empty) {
          return NextResponse.json(
            { error: `Partner code "${normalizedCode}" is already in use` },
            { status: 409 }
          );
        }
      }
      updateData.code = normalizedCode;
    }

    // Mode A fields
    if (body.commissionModel !== undefined) updateData.commissionModel = body.commissionModel;
    if (body.commissionPercent !== undefined) updateData.commissionPercent = body.commissionPercent;
    if (body.commissionFlat !== undefined) updateData.commissionFlat = body.commissionFlat;
    if (body.commissionTiers !== undefined) updateData.commissionTiers = body.commissionTiers;
    if (body.payoutFrequency !== undefined) updateData.payoutFrequency = body.payoutFrequency;

    // Mode B fields
    if (body.partnerRateDiscount !== undefined) updateData.partnerRateDiscount = body.partnerRateDiscount;

    // Payment fields
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
    if (body.payIdPhone !== undefined) updateData.payIdPhone = body.payIdPhone;
    if (body.bankBSB !== undefined) updateData.bankBSB = body.bankBSB;
    if (body.bankAccountNumber !== undefined) updateData.bankAccountNumber = body.bankAccountNumber;
    if (body.bankAccountName !== undefined) updateData.bankAccountName = body.bankAccountName;

    // Currency
    if (body.currency !== undefined) {
      updateData.currency = body.currency === "NZD" ? "NZD" : "AUD";
    }

    // Contact fields
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson?.trim() || null;
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone?.trim() || null;
    if (body.address !== undefined) updateData.address = body.address?.trim() || null;
    if (body.companyName !== undefined) updateData.companyName = body.companyName?.trim() || null;
    if (body.companyRegistrationNumber !== undefined) updateData.companyRegistrationNumber = body.companyRegistrationNumber?.trim() || null;

    await partnerRef.update(updateData);

    // Return updated partner
    const updatedDoc = await partnerRef.get();
    const updatedData = updatedDoc.data()!;

    return NextResponse.json({
      id: updatedDoc.id,
      name: updatedData.name,
      code: updatedData.code,
      contactEmail: updatedData.contactEmail,
      modes: updatedData.modes,
      status: updatedData.status,
      commissionModel: updatedData.commissionModel ?? null,
      commissionPercent: updatedData.commissionPercent ?? null,
      commissionFlat: updatedData.commissionFlat ?? null,
      commissionTiers: updatedData.commissionTiers ?? null,
      payoutFrequency: updatedData.payoutFrequency ?? "monthly",
      partnerRateDiscount: updatedData.partnerRateDiscount ?? null,
      currency: updatedData.currency ?? "AUD",
      contactPerson: updatedData.contactPerson ?? null,
      contactPhone: updatedData.contactPhone ?? null,
      address: updatedData.address ?? null,
      companyName: updatedData.companyName ?? null,
      companyRegistrationNumber: updatedData.companyRegistrationNumber ?? null,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating partner:", error);
    return NextResponse.json(
      { error: "Failed to update partner" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate: () => Date };
    return ts.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
