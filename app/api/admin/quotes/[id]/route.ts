import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { onQuotePaid } from "@/lib/commission-trigger";
import { requireAdmin } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import QuotePaidEmail from "@/emails/quote-paid";
import QuoteRevisedEmail from "@/emails/quote-revised";
import { checkRevisionExpiry } from "@/lib/revision-expiry";
import { serializeTimestamp } from "@/lib/serialize";

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  quoted: ["accepted", "cancelled"],
  accepted: ["shipped", "cancelled"],
  shipped: ["received", "cancelled"],
  received: ["revised", "inspected", "cancelled"],
  revised: ["inspected", "returning", "cancelled"],
  returning: ["returned", "cancelled"],
  returned: [],
  inspected: ["paid", "cancelled"],
  paid: ["cancelled"],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// GET /api/admin/quotes/[id] — Get full quote detail including device info
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;
    const quoteRef = adminDb.collection("quotes").doc(id);
    const quoteDoc = await quoteRef.get();

    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    // Check for revision expiry (auto-transitions if expired)
    await checkRevisionExpiry("quotes", id);
    // Re-fetch in case expiry changed the status
    const freshQuoteDoc = await quoteRef.get();
    const data = freshQuoteDoc.data()!;

    // Fetch associated device
    let device: Record<string, unknown> | null = null;
    if (data.deviceId && typeof data.deviceId === "string") {
      const deviceDoc = await adminDb
        .collection("devices")
        .doc(data.deviceId)
        .get();
      if (deviceDoc.exists) {
        device = { id: deviceDoc.id, ...deviceDoc.data() } as Record<
          string,
          unknown
        >;
      }
    }

    // Fetch partner info if attributed
    let partnerName: string | null = null;
    const partnerId = (data.partnerId as string) ?? null;
    if (partnerId) {
      const partnerDoc = await adminDb
        .collection("partners")
        .doc(partnerId)
        .get();
      if (partnerDoc.exists) {
        partnerName = (partnerDoc.data()?.name as string) ?? null;
      }
    }

    const quote = {
      id: quoteDoc.id,
      deviceId: data.deviceId,
      device: {
        id: data.deviceId ?? "",
        make: (device?.make as string) ?? "",
        model: (device?.model as string) ?? "",
        storage: (device?.storage as string) ?? "",
      },
      grade: data.grade,
      quotePriceNZD: data.quotePriceNZD,
      displayCurrency: data.displayCurrency,
      status: data.status,
      customerName: data.customerName ?? null,
      customerEmail: data.customerEmail ?? null,
      customerPhone: data.customerPhone ?? null,
      paymentMethod: data.paymentMethod ?? null,
      payIdPhone: data.payIdPhone ?? null,
      bankBSB: data.bankBSB ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankAccountName: data.bankAccountName ?? null,
      customerId: data.customerId ?? null,
      partnerId,
      partnerName,
      partnerMode: data.partnerMode ?? null,
      imei: data.imei ?? null,
      inspectionGrade: data.inspectionGrade ?? null,
      revisedPriceNZD: data.revisedPriceNZD ?? null,
      revisedDeviceId: data.revisedDeviceId ?? null,
      revisedDeviceMake: data.revisedDeviceMake ?? null,
      revisedDeviceModel: data.revisedDeviceModel ?? null,
      revisedDeviceStorage: data.revisedDeviceStorage ?? null,
      revisedAt: serializeTimestamp(data.revisedAt),
      revisionExpiresAt: serializeTimestamp(data.revisionExpiresAt),
      revisionAutoExpired: data.revisionAutoExpired ?? null,
      returningAt: serializeTimestamp(data.returningAt),
      returnedAt: serializeTimestamp(data.returnedAt),
      platform: data.platform ?? null,
      geoCountry: data.geoCountry ?? null,
      geoCity: data.geoCity ?? null,
      geoRegion: data.geoRegion ?? null,
      sandbox: data.sandbox === true,
      createdAt: serializeTimestamp(data.createdAt),
      expiresAt: serializeTimestamp(data.expiresAt),
      acceptedAt: serializeTimestamp(data.acceptedAt),
    };

    return NextResponse.json(quote);
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/quotes/[id] — Update quote status (and optionally
// inspectionGrade / revisedPriceNZD)
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
    const {
      status,
      inspectionGrade,
      revisedPriceNZD,
      revisedDeviceId,
      revisedDeviceMake,
      revisedDeviceModel,
      revisedDeviceStorage,
    } = body;

    const quoteRef = adminDb.collection("quotes").doc(id);
    const quoteDoc = await quoteRef.get();

    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    const currentData = quoteDoc.data()!;
    const currentStatus = currentData.status as string;

    // Build update payload
    const updateData: Record<string, unknown> = {};

    // Validate and apply status transition if provided
    if (status && typeof status === "string") {
      const allowedTransitions = VALID_TRANSITIONS[currentStatus];

      if (!allowedTransitions) {
        return NextResponse.json(
          {
            error: `Current status "${currentStatus}" is not recognized`,
          },
          { status: 400 }
        );
      }

      if (!allowedTransitions.includes(status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from "${currentStatus}" to "${status}". Allowed transitions: ${allowedTransitions.join(", ") || "none"}`,
          },
          { status: 400 }
        );
      }

      updateData.status = status;
    }

    // Apply optional inspection fields
    if (inspectionGrade !== undefined) {
      updateData.inspectionGrade = inspectionGrade;
    }
    if (revisedPriceNZD !== undefined) {
      updateData.revisedPriceNZD = revisedPriceNZD;
    }

    // Apply optional revised device fields
    if (revisedDeviceId !== undefined) {
      updateData.revisedDeviceId = revisedDeviceId;
    }
    if (revisedDeviceMake !== undefined) {
      updateData.revisedDeviceMake = revisedDeviceMake;
    }
    if (revisedDeviceModel !== undefined) {
      updateData.revisedDeviceModel = revisedDeviceModel;
    }
    if (revisedDeviceStorage !== undefined) {
      updateData.revisedDeviceStorage = revisedDeviceStorage;
    }

    // Set timestamps for revision-related transitions
    if (updateData.status === "revised") {
      updateData.revisedAt = admin.firestore.FieldValue.serverTimestamp();
      const expiryDays = parseInt(process.env.REVISION_EXPIRY_DAYS ?? "14", 10);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
      updateData.revisionExpiresAt = admin.firestore.Timestamp.fromDate(expiresAt);
    }
    if (updateData.status === "returning") {
      updateData.returningAt = admin.firestore.FieldValue.serverTimestamp();
    }
    if (updateData.status === "returned") {
      updateData.returnedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    await quoteRef.update(updateData);

    const isSandbox = currentData.sandbox === true;

    // Send revision notification email if transitioning to "revised" — skip for sandbox
    if (updateData.status === "revised" && !isSandbox) {
      const freshDoc = await quoteRef.get();
      const freshData = freshDoc.data()!;
      if (freshData.customerEmail) {
        let deviceLabel = "your device";
        if (freshData.deviceId && typeof freshData.deviceId === "string") {
          const deviceDoc = await adminDb
            .collection("devices")
            .doc(freshData.deviceId as string)
            .get();
          if (deviceDoc.exists) {
            const d = deviceDoc.data()!;
            deviceLabel = `${d.make} ${d.model} ${d.storage}`.trim();
          }
        }

        const revisedDeviceName =
          freshData.revisedDeviceId
            ? `${freshData.revisedDeviceMake} ${freshData.revisedDeviceModel} ${freshData.revisedDeviceStorage}`.trim()
            : undefined;

        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhex.app";
        const quoteUrl = freshData.partnerId
          ? `${siteUrl}/partner/quotes/${id}`
          : `${siteUrl}/sell/quote/${id}`;

        const expiresAtDate =
          freshData.revisionExpiresAt?.toDate?.() ??
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        sendEmail({
          to: freshData.customerEmail as string,
          subject:
            "Your trade-in device has been inspected — action required",
          react: QuoteRevisedEmail({
            customerName:
              (freshData.customerName as string) ?? "there",
            deviceName: deviceLabel,
            originalGrade: freshData.grade as string,
            revisedGrade: freshData.inspectionGrade as string,
            originalPrice:
              (freshData.quotePriceDisplay as number) ??
              (freshData.quotePriceNZD as number) ??
              0,
            revisedPrice: (freshData.revisedPriceNZD as number) ?? 0,
            currency:
              (freshData.displayCurrency as string) ?? "AUD",
            quoteUrl,
            expiresAt: expiresAtDate.toLocaleDateString("en-NZ", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            deviceChanged: !!freshData.revisedDeviceId,
            revisedDeviceName,
          }),
        });
      }
    }

    // Trigger commission + email if transitioning to "paid" — skip for sandbox
    if (updateData.status === "paid" && !isSandbox) {
      const freshDoc = await quoteRef.get();
      const freshData = freshDoc.data() as Record<string, unknown>;
      await onQuotePaid(id, freshData).catch((err) =>
        console.error("Commission trigger error:", err)
      );

      // Send payment confirmation email (non-blocking)
      if (freshData.customerEmail) {
        let deviceLabel = "your device";
        if (freshData.deviceId && typeof freshData.deviceId === "string") {
          const deviceDoc = await adminDb.collection("devices").doc(freshData.deviceId as string).get();
          if (deviceDoc.exists) {
            const d = deviceDoc.data()!;
            deviceLabel = `${d.make} ${d.model} ${d.storage}`.trim();
          }
        }
        const googlePlaceId = process.env.GOOGLE_PLACE_ID;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rhex.app";
        sendEmail({
          to: freshData.customerEmail as string,
          subject: "Payment sent for your trade-in",
          react: QuotePaidEmail({
            customerName: (freshData.customerName as string) ?? "there",
            deviceName: deviceLabel,
            finalPrice: (freshData.revisedPriceNZD as number) ?? (freshData.quotePriceDisplay as number) ?? (freshData.quotePriceNZD as number) ?? 0,
            currency: (freshData.displayCurrency as string) ?? "AUD",
            paymentMethod: (freshData.paymentMethod as string) ?? "bank_transfer",
            googleReviewUrl: googlePlaceId
              ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
              : undefined,
            feedbackUrl: `${siteUrl}/feedback/${id}`,
          }),
        });
      }
    }

    // Return the updated quote
    const updatedDoc = await quoteRef.get();
    const updatedData = updatedDoc.data()!;

    return NextResponse.json({
      id: updatedDoc.id,
      status: updatedData.status,
      inspectionGrade: updatedData.inspectionGrade ?? null,
      revisedPriceNZD: updatedData.revisedPriceNZD ?? null,
      revisedDeviceId: updatedData.revisedDeviceId ?? null,
      revisedDeviceMake: updatedData.revisedDeviceMake ?? null,
      revisedDeviceModel: updatedData.revisedDeviceModel ?? null,
      revisedDeviceStorage: updatedData.revisedDeviceStorage ?? null,
      revisedAt: serializeTimestamp(updatedData.revisedAt),
      revisionExpiresAt: serializeTimestamp(updatedData.revisionExpiresAt),
      returningAt: serializeTimestamp(updatedData.returningAt),
      returnedAt: serializeTimestamp(updatedData.returnedAt),
    });
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
  }
}
