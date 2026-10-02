import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, canAccess } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { applyQuoteExpiry } from "@/lib/quote-expiry";
import { serializeTimestamp } from "@/lib/serialize";
import { v1QuoteStatus, v1RevisedPrice } from "@/lib/v1-quote";

// ---------------------------------------------------------------------------
// GET /api/v1/quotes/[id] — Get quote status with device info
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth
  const result = await requireApiKey(request);
  if (result instanceof NextResponse) return result;
  const partner: ApiKeyPartner = result;

  // Rate limit
  const rl = await checkRateLimit(partner.apiKeyId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { id } = await params;

    const quoteDoc = await adminDb.collection("quotes").doc(id).get();

    // Ownership + sandbox check
    if (!quoteDoc.exists || !canAccess(quoteDoc.data(), partner)) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Check for revision expiry
    const quoteData = (await applyQuoteExpiry(quoteDoc))!;

    // Fetch device info
    let device = null;
    if (quoteData.deviceId) {
      const deviceDoc = await adminDb
        .collection("devices")
        .doc(quoteData.deviceId)
        .get();

      if (deviceDoc.exists) {
        const deviceData = deviceDoc.data();
        device = {
          id: deviceDoc.id,
          make: deviceData?.make,
          model: deviceData?.model,
          storage: deviceData?.storage,
        };
      }
    }

    // Serialize timestamps
    const serialized: Record<string, unknown> = {
      id: quoteDoc.id,
      deviceId: quoteData.deviceId,
      grade: quoteData.grade,
      quotePriceNZD: quoteData.quotePriceNZD,
      publicPriceNZD: quoteData.publicPriceNZD ?? null,
      quotePrice: quoteData.quotePriceDisplay ?? quoteData.quotePriceNZD,
      displayCurrency: quoteData.displayCurrency ?? "NZD",
      status: v1QuoteStatus(quoteData),
      source: quoteData.source ?? null,
      tradeInRef: quoteData.tradeInRef ?? null,
      imei: quoteData.imei ?? null,
      customerName: quoteData.customerName ?? null,
      customerEmail: quoteData.customerEmail ?? null,
      inspectionGrade: quoteData.inspectionGrade ?? null,
      revisedPriceNZD: quoteData.revisedPriceNZD ?? null,
      revisedPrice: v1RevisedPrice(quoteData),
      revisedDeviceId: quoteData.revisedDeviceId ?? null,
      revisedDeviceMake: quoteData.revisedDeviceMake ?? null,
      revisedDeviceModel: quoteData.revisedDeviceModel ?? null,
      revisedDeviceStorage: quoteData.revisedDeviceStorage ?? null,
      createdAt: serializeTimestamp(quoteData.createdAt),
      expiresAt: serializeTimestamp(quoteData.expiresAt),
      acceptedAt: serializeTimestamp(quoteData.acceptedAt),
      revisedAt: serializeTimestamp(quoteData.revisedAt),
      revisionExpiresAt: serializeTimestamp(quoteData.revisionExpiresAt),
      trackingNumber: quoteData.trackingNumber ?? null,
      labelSentAt: serializeTimestamp(quoteData.labelSentAt),
      postByAt: serializeTimestamp(quoteData.postByAt),
      shippedAt: serializeTimestamp(quoteData.shippedAt),
      receivedAt: serializeTimestamp(quoteData.receivedAt),
      inspectedAt: serializeTimestamp(quoteData.inspectedAt),
      completedAt: serializeTimestamp(quoteData.paidAt),
      returningAt: serializeTimestamp(quoteData.returningAt),
      returnedAt: serializeTimestamp(quoteData.returnedAt),
      device,
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error fetching v1 quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
