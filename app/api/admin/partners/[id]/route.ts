import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { serializeTimestamp } from "@/lib/serialize";
import { partnerApiMode } from "@/lib/api-key-auth";
import {
  PARTNER_MODES,
  customerEmailSwitches,
  neverArrivedResultOn,
  labelArrangementFor,
  parseLabelArrangement,
  parseCustomerEmails,
  parseEmailBrand,
  parseEmailList,
  parseNeverArrivedResult,
  parseOptionalEmail,
  parseResultWebhook,
} from "@/lib/partner-config";
import { sandboxEmailConfig } from "@/lib/sandbox-email";

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
      // Mode B / C
      partnerRateDiscount: data.partnerRateDiscount ?? null,
      apiMode: partnerApiMode(data),
      // Mode C
      resultWebhook: {
        url: data.resultWebhook?.url ?? null,
        sandboxUrl: data.resultWebhook?.sandboxUrl ?? null,
        secretEnv: data.resultWebhook?.secretEnv ?? null,
        sandboxSecretEnv: data.resultWebhook?.sandboxSecretEnv ?? null,
        // Whether the named env vars are set here (never their values)
        secretSet: !!(data.resultWebhook?.secretEnv && process.env[data.resultWebhook.secretEnv]),
        sandboxSecretSet: !!(
          data.resultWebhook?.sandboxSecretEnv && process.env[data.resultWebhook.sandboxSecretEnv]
        ),
      },
      sandboxEmailAllowlist: sandboxEmailConfig(data).allowlist,
      sandboxEmailFallback: sandboxEmailConfig(data).fallback,
      emailBrand: {
        displayName: data.emailBrand?.displayName ?? null,
        logoUrl: data.emailBrand?.logoUrl ?? null,
        supportEmail: data.emailBrand?.supportEmail ?? null,
        supportPhone: data.emailBrand?.supportPhone ?? null,
      },
      customerEmails: customerEmailSwitches(data),
      neverArrivedResult: neverArrivedResultOn(data),
      labels: labelArrangementFor(data),
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
      // Widget
      widgetEnabled: data.widgetEnabled ?? false,
      widgetPrimaryColor: data.widgetPrimaryColor ?? null,
      widgetLogoUrl: data.widgetLogoUrl ?? null,
      widgetCustomHeading: data.widgetCustomHeading ?? null,
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
      const validModes: readonly string[] = PARTNER_MODES;
      updateData.modes = body.modes.filter((m: string) => validModes.includes(m));
    }

    // API mode: the mode API quotes are created in
    if (body.apiMode !== undefined) {
      if (body.apiMode !== null && body.apiMode !== "B" && body.apiMode !== "C") {
        return NextResponse.json({ error: "apiMode must be B, C or null" }, { status: 400 });
      }
      updateData.apiMode = body.apiMode;
    }

    // Mode C: result webhook, sandbox email routing, customer email brand and switches
    try {
      if (body.resultWebhook !== undefined) {
        updateData.resultWebhook = parseResultWebhook(body.resultWebhook);
      }
      if (body.sandboxEmailAllowlist !== undefined) {
        updateData.sandboxEmailAllowlist = parseEmailList(body.sandboxEmailAllowlist);
      }
      if (body.sandboxEmailFallback !== undefined) {
        updateData.sandboxEmailFallback = parseOptionalEmail(
          body.sandboxEmailFallback,
          "Sandbox fallback inbox"
        );
      }
      if (body.emailBrand !== undefined) {
        updateData.emailBrand = parseEmailBrand(body.emailBrand);
      }
      if (body.customerEmails !== undefined) {
        updateData.customerEmails = parseCustomerEmails(body.customerEmails);
      }
      if (body.neverArrivedResult !== undefined) {
        updateData.neverArrivedResult = parseNeverArrivedResult(body.neverArrivedResult);
      }
      if (body.labels !== undefined) {
        updateData.labels = parseLabelArrangement(body.labels);
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid settings" },
        { status: 400 }
      );
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

    // Widget fields
    if (body.widgetEnabled !== undefined) updateData.widgetEnabled = !!body.widgetEnabled;
    if (body.widgetPrimaryColor !== undefined) updateData.widgetPrimaryColor = body.widgetPrimaryColor?.trim() || null;
    if (body.widgetLogoUrl !== undefined) updateData.widgetLogoUrl = body.widgetLogoUrl?.trim() || null;
    if (body.widgetCustomHeading !== undefined) updateData.widgetCustomHeading = body.widgetCustomHeading?.trim() || null;

    // Contact fields
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson?.trim() || null;
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone?.trim() || null;
    if (body.address !== undefined) updateData.address = body.address?.trim() || null;
    if (body.companyName !== undefined) updateData.companyName = body.companyName?.trim() || null;
    if (body.companyRegistrationNumber !== undefined) updateData.companyRegistrationNumber = body.companyRegistrationNumber?.trim() || null;

    // If contactEmail changed, also update Firebase Auth email
    if (updateData.contactEmail) {
      const currentData = partnerDoc.data()!;
      if (currentData.authUid) {
        await admin.auth().updateUser(currentData.authUid, {
          email: updateData.contactEmail as string,
        });
      }
    }

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
      apiMode: partnerApiMode(updatedData),
      currency: updatedData.currency ?? "AUD",
      contactPerson: updatedData.contactPerson ?? null,
      contactPhone: updatedData.contactPhone ?? null,
      address: updatedData.address ?? null,
      companyName: updatedData.companyName ?? null,
      companyRegistrationNumber: updatedData.companyRegistrationNumber ?? null,
      widgetEnabled: updatedData.widgetEnabled ?? false,
      widgetPrimaryColor: updatedData.widgetPrimaryColor ?? null,
      widgetLogoUrl: updatedData.widgetLogoUrl ?? null,
      widgetCustomHeading: updatedData.widgetCustomHeading ?? null,
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
