import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";
import { calculatePartnerRate } from "@/lib/partner-pricing";
import { readGrades } from "@/lib/grades";
import { getActivePriceList, getCategoryGrades } from "@/lib/categories";
import { parsePlatform } from "@/lib/parse-platform";

// ---------------------------------------------------------------------------
// POST /api/partner/quote — Create a single quote at partner rate (Mode B)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  if (!partner.modes.includes("B")) {
    return NextResponse.json(
      { error: "Mode B access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { deviceId, grade } = body;

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
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    const deviceData = deviceDoc.data()!;
    if (deviceData.active === false) {
      return NextResponse.json(
        { error: "This device is not currently available for trade-in" },
        { status: 404 }
      );
    }

    // Validate grade against category's grade set
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

    // Lookup price from active price list for this category
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

    // Calculate expiry (14 days)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Capture client metadata from request headers
    const userAgent = request.headers.get("user-agent") ?? null;
    const geoCountry = request.headers.get("x-vercel-ip-country") ?? null;
    const geoCity = request.headers.get("x-vercel-ip-city") ?? null;
    const geoRegion = request.headers.get("x-vercel-ip-region") ?? null;
    const platform = userAgent ? parsePlatform(userAgent) : null;

    const quoteData = {
      deviceId,
      grade: normalizedGrade,
      quotePriceNZD: partnerPriceNZD,
      publicPriceNZD: Number(publicPriceNZD),
      displayCurrency: "NZD",
      fxRate: 1,
      status: "quoted",
      partnerId: partner.id,
      partnerMode: "B",
      partnerRateDiscount: discount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      userAgent,
      platform,
      geoCountry,
      geoCity,
      geoRegion,
    };

    const quoteRef = await adminDb.collection("quotes").add(quoteData);

    return NextResponse.json(
      {
        id: quoteRef.id,
        ...quoteData,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating partner quote:", error);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}
