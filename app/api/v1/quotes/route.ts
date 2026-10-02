import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { calculatePartnerRate } from "@/lib/partner-pricing";
import { readGrades } from "@/lib/grades";
import { getActivePriceList, getCategoryGrades } from "@/lib/categories";
import { parsePlatform } from "@/lib/parse-platform";
import { getTodayFXRate, convertPrice } from "@/lib/fx";
import { PARTNER_QUOTE_VALIDITY_MS } from "@/lib/quote-validity";

// ---------------------------------------------------------------------------
// POST /api/v1/quotes — Create a single-device quote at partner rate
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

  try {
    const body = await request.json();
    const { deviceId, grade, imei } = body;

    if (!deviceId || !grade) {
      return NextResponse.json(
        { error: "deviceId and grade are required" },
        { status: 400 }
      );
    }

    const normalizedGrade = grade.toUpperCase();

    // Lookup device
    const deviceDoc = await adminDb.collection("devices").doc(deviceId).get();
    if (!deviceDoc.exists) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const deviceData = deviceDoc.data()!;
    if (deviceData.active === false) {
      return NextResponse.json(
        { error: "This device is not currently available for trade-in" },
        { status: 404 }
      );
    }

    // Validate grade against category
    const category = (deviceData.category as string) ?? "Phone";
    const categoryGrades = await getCategoryGrades(category);
    const validGradeKeys =
      categoryGrades.length > 0
        ? categoryGrades.map((g) => g.key)
        : ["A", "B", "C", "D", "E"];

    if (!validGradeKeys.includes(normalizedGrade)) {
      return NextResponse.json(
        { error: `Invalid grade "${normalizedGrade}" for ${category}` },
        { status: 400 }
      );
    }

    // Lookup price from active price list
    const priceListId = await getActivePriceList(category);
    if (!priceListId) {
      return NextResponse.json(
        { error: "No pricing available for this device category" },
        { status: 404 }
      );
    }

    const priceDoc = await adminDb
      .doc(`priceLists/${priceListId}/prices/${deviceId}`)
      .get();

    if (!priceDoc.exists) {
      return NextResponse.json(
        { error: "No pricing available for this device" },
        { status: 404 }
      );
    }

    const priceData = priceDoc.data()!;
    const grades = readGrades(priceData);
    const publicPriceNZD = grades[normalizedGrade];

    if (publicPriceNZD === undefined || publicPriceNZD === null) {
      return NextResponse.json(
        { error: `No price available for grade ${normalizedGrade}` },
        { status: 404 }
      );
    }

    // Calculate partner rate
    const discount = partner.partnerRateDiscount ?? 10;
    const partnerPriceNZD = calculatePartnerRate(
      Number(publicPriceNZD),
      discount
    );

    // FX conversion
    const currency = partner.currency ?? "NZD";
    const fxRates = currency !== "NZD" ? await getTodayFXRate() : null;
    const fxRate = fxRates?.NZD_AUD ?? 1;
    const quotePriceDisplay = convertPrice(partnerPriceNZD, currency, fxRate);
    const publicPriceDisplay = convertPrice(Number(publicPriceNZD), currency, fxRate);

    // Calculate expiry (1 hour for sandbox, 14 days for production)
    const now = new Date();
    const expiryMs = partner.sandbox
      ? 1 * 60 * 60 * 1000
      : PARTNER_QUOTE_VALIDITY_MS;
    const expiresAt = new Date(now.getTime() + expiryMs);

    // Capture client metadata
    const userAgent = request.headers.get("user-agent") ?? null;
    const geoCountry = request.headers.get("x-vercel-ip-country") ?? null;
    const geoCity = request.headers.get("x-vercel-ip-city") ?? null;
    const geoRegion = request.headers.get("x-vercel-ip-region") ?? null;
    const platform = userAgent ? parsePlatform(userAgent) : null;

    const quoteData: Record<string, unknown> = {
      deviceId,
      grade: normalizedGrade,
      quotePriceNZD: partnerPriceNZD,
      publicPriceNZD: Number(publicPriceNZD),
      displayCurrency: currency,
      fxRate,
      quotePriceDisplay,
      status: "quoted",
      partnerId: partner.id,
      partnerMode: "B",
      partnerRateDiscount: discount,
      source: "api",
      ...(partner.sandbox && { sandbox: true }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      userAgent,
      platform,
      geoCountry,
      geoCity,
      geoRegion,
    };

    if (imei && typeof imei === "string" && /^\d{15}$/.test(imei)) {
      quoteData.imei = imei;
    }

    const quoteRef = await adminDb.collection("quotes").add(quoteData);

    return NextResponse.json(
      {
        id: quoteRef.id,
        deviceId,
        grade: normalizedGrade,
        quotePriceNZD: partnerPriceNZD,
        publicPriceNZD: Number(publicPriceNZD),
        quotePrice: quotePriceDisplay,
        publicPrice: publicPriceDisplay,
        displayCurrency: currency,
        status: "quoted",
        source: "api",
        ...(partner.sandbox && { sandbox: true }),
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating v1 quote:", error);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}
