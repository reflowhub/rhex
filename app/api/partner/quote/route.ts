import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";
import { calculatePartnerRate } from "@/lib/partner-pricing";

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

    const validGrades = ["A", "B", "C", "D", "E"];
    const normalizedGrade = grade.toUpperCase();
    if (!validGrades.includes(normalizedGrade)) {
      return NextResponse.json(
        { error: "grade must be A, B, C, D, or E" },
        { status: 400 }
      );
    }

    // Lookup device
    const deviceDoc = await adminDb.collection("devices").doc(deviceId).get();
    if (!deviceDoc.exists) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Lookup price
    const priceDoc = await adminDb
      .doc(`priceLists/FP-2B/prices/${deviceId}`)
      .get();

    if (!priceDoc.exists) {
      return NextResponse.json(
        { error: "No pricing available for this device" },
        { status: 404 }
      );
    }

    const priceData = priceDoc.data();
    const gradeField = `grade${normalizedGrade}`;
    const publicPriceNZD = priceData?.[gradeField];

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
