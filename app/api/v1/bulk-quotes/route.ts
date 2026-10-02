import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, apiPartnerDiscount } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildPartnerEstimate, EstimateError } from "@/lib/partner-estimate";
import { getTodayFXRate, convertPrice } from "@/lib/fx";

// ---------------------------------------------------------------------------
// POST /api/v1/bulk-quotes — Create bulk quote from manifest or device list
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
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

  // Mode C trade-ins are single devices at checkout
  if (partner.apiMode === "C") {
    return NextResponse.json(
      { error: "Bulk quotes aren't available for this account" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const discount = apiPartnerDiscount(partner);

    const estimate = await buildPartnerEstimate({
      csv: body.csv,
      devices: body.devices,
      category: body.category,
      assumedGrade: body.assumedGrade,
      discount,
    });
    const {
      type,
      category,
      assumedGrade: grade,
      lines: deviceLines,
      totalIndicativeNZD,
      totalPublicNZD,
      matchedCount,
      unmatchedCount,
    } = estimate;

    // FX conversion
    const currency = partner.currency ?? "NZD";
    const fxRates = currency !== "NZD" ? await getTodayFXRate() : null;
    const fxRate = fxRates?.NZD_AUD ?? 1;
    const totalIndicativeDisplay = convertPrice(totalIndicativeNZD, currency, fxRate);
    const totalPublicDisplay = convertPrice(totalPublicNZD, currency, fxRate);

    // Create bulk quote document
    const bulkQuoteData: Record<string, unknown> = {
      type,
      category,
      assumedGrade: grade,
      totalDevices: estimate.totalDevices,
      totalIndicativeNZD,
      totalPublicNZD,
      totalIndicativeDisplay,
      totalPublicDisplay,
      displayCurrency: currency,
      fxRate,
      matchedCount,
      unmatchedCount,
      status: "estimated",
      partnerId: partner.id,
      partnerMode: "B",
      partnerRateDiscount: discount,
      source: "api",
      ...(partner.sandbox && { sandbox: true }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedAt: null,
    };

    const bulkQuoteRef = await adminDb
      .collection("bulkQuotes")
      .add(bulkQuoteData);

    // Write device lines in batches
    const BATCH_SIZE = 200;
    for (let i = 0; i < deviceLines.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = deviceLines.slice(i, i + BATCH_SIZE);
      chunk.forEach((line) => {
        const lineRef = bulkQuoteRef.collection("devices").doc();
        batch.set(lineRef, {
          rawInput: line.rawInput,
          deviceId: line.deviceId,
          deviceName: line.deviceName,
          matchConfidence: line.matchConfidence,
          quantity: line.quantity,
          assumedGrade: line.assumedGrade,
          indicativePriceNZD: line.indicativePriceNZD,
          publicPriceNZD: line.publicPriceNZD,
          indicativePrice: convertPrice(line.indicativePriceNZD, currency, fxRate),
          publicPrice: convertPrice(line.publicPriceNZD, currency, fxRate),
        });
      });
      await batch.commit();
    }

    return NextResponse.json(
      {
        id: bulkQuoteRef.id,
        totalDevices: bulkQuoteData.totalDevices,
        totalIndicativeNZD,
        totalIndicative: totalIndicativeDisplay,
        displayCurrency: currency,
        matchedCount,
        unmatchedCount,
        lineCount: deviceLines.length,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof EstimateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating v1 bulk quote:", error);
    return NextResponse.json(
      { error: "Failed to create bulk quote" },
      { status: 500 }
    );
  }
}
