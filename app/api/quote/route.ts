import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { getTodayFXRate, convertPrice } from "@/lib/fx";
import { readGrades } from "@/lib/grades";

// POST /api/quote — Create a new quote
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, grade, imei, displayCurrency, referralCode } = body;

    if (!deviceId || !grade) {
      return NextResponse.json(
        { error: "deviceId and grade are required" },
        { status: 400 }
      );
    }

    // Validate grade
    const validGrades = ["A", "B", "C", "D", "E"];
    if (!validGrades.includes(grade.toUpperCase())) {
      return NextResponse.json(
        { error: "grade must be A, B, C, D, or E" },
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

    // Lookup price from priceLists/FP-2B/prices/{deviceId}
    const priceDoc = await adminDb
      .doc(`priceLists/FP-2B/prices/${deviceId}`)
      .get();

    if (!priceDoc.exists) {
      return NextResponse.json(
        { error: "No pricing available for this device" },
        { status: 404 }
      );
    }

    const priceData = priceDoc.data()!;
    const grades = readGrades(priceData);
    const quotePriceNZD = grades[normalizedGrade];

    if (quotePriceNZD === undefined || quotePriceNZD === null) {
      return NextResponse.json(
        { error: `No price available for grade ${normalizedGrade}` },
        { status: 404 }
      );
    }

    // Calculate expiry (14 days from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Currency conversion
    const currency = displayCurrency === "AUD" ? "AUD" : "NZD";
    let fxRate = 1;
    let quotePriceDisplay = Number(quotePriceNZD);

    if (currency === "AUD") {
      const rates = await getTodayFXRate();
      fxRate = rates.NZD_AUD;
      quotePriceDisplay = convertPrice(Number(quotePriceNZD), "AUD", fxRate, 5);
    }

    // Resolve referral code to partner (Mode A attribution)
    let partnerId: string | null = null;
    let partnerMode: string | null = null;

    if (referralCode && typeof referralCode === "string") {
      const normalizedRef = referralCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (normalizedRef.length >= 3) {
        const partnerSnapshot = await adminDb
          .collection("partners")
          .where("code", "==", normalizedRef)
          .where("status", "==", "active")
          .limit(1)
          .get();

        if (!partnerSnapshot.empty) {
          const partnerDoc = partnerSnapshot.docs[0];
          const partnerData = partnerDoc.data();
          if (partnerData.modes?.includes("A")) {
            partnerId = partnerDoc.id;
            partnerMode = "A";
          }
        }
      }
    }

    // Create quote document
    const quoteData: Record<string, unknown> = {
      deviceId,
      grade: normalizedGrade,
      imei: imei || null,
      quotePriceNZD: Number(quotePriceNZD),
      quotePriceDisplay,
      displayCurrency: currency,
      fxRate,
      status: "quoted",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    };

    if (partnerId) {
      quoteData.partnerId = partnerId;
      quoteData.partnerMode = partnerMode;
    }

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
    console.error("Error creating quote:", error);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}
