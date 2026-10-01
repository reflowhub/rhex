import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { matchDeviceString, loadDeviceLibrary } from "@/lib/matching";
import { calculatePartnerRate } from "@/lib/partner-pricing";
import { getPrices } from "@/lib/device-cache";
import { getActivePriceList, getCategoryGrades } from "@/lib/categories";
import { parseManifestRows } from "@/lib/manifest-csv";

// ---------------------------------------------------------------------------
// POST /api/business/estimate — Create a bulk estimate from manifest CSV
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csv, deviceLines, assumedGrade, businessName, contactEmail, referralCode, category: bodyCategory, type: bodyType } = body;

    const isBuildList = bodyType === "build_list" && Array.isArray(deviceLines);

    if (!isBuildList && (!csv || typeof csv !== "string")) {
      return NextResponse.json(
        { error: "csv or deviceLines is required" },
        { status: 400 }
      );
    }

    // Determine category and load valid grades
    const category = (bodyCategory as string) || "Phone";
    const categoryGrades = await getCategoryGrades(category);
    const validGrades =
      categoryGrades.length > 0
        ? categoryGrades.map((g) => g.key)
        : ["A", "B", "C", "D", "E"];

    const grade = (assumedGrade || validGrades[Math.floor(validGrades.length / 2)] || "C").toUpperCase();
    if (!validGrades.includes(grade)) {
      return NextResponse.json(
        { error: `Invalid grade "${grade}" for ${category}` },
        { status: 400 }
      );
    }

    // Lookup active price list for this category
    const priceListId = await getActivePriceList(category);
    if (!priceListId) {
      return NextResponse.json(
        { error: `No pricing available for category "${category}"` },
        { status: 404 }
      );
    }

    // Process each row
    interface ProcessedLine {
      rawInput: string;
      deviceId: string | null;
      deviceName: string | null;
      matchConfidence: "high" | "medium" | "low" | "exact" | "manual";
      quantity: number;
      assumedGrade: string;
      indicativePriceNZD: number;
    }

    // Fetch global business estimate discount setting
    const settingsDoc = await adminDb.doc("settings/trade-in").get();
    const businessEstimateDiscount =
      settingsDoc.data()?.businessEstimateDiscount ?? 0;

    const processedLines: ProcessedLine[] = [];
    let totalIndicativeNZD = 0;
    let totalPublicNZD = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    // Fetch price list for pricing lookups (from cache)
    const priceMap = await getPrices(priceListId);

    if (isBuildList) {
      // -----------------------------------------------------------------------
      // Build list flow: device IDs are known, skip matching entirely
      // -----------------------------------------------------------------------
      for (const line of deviceLines as { deviceId: string; name: string; quantity: number; grade: string }[]) {
        const rowGrade = validGrades.includes(line.grade?.toUpperCase())
          ? line.grade.toUpperCase()
          : grade;
        const quantity = Math.max(1, parseInt(String(line.quantity), 10) || 1);

        let indicativePriceNZD = 0;
        let publicPriceNZD = 0;
        const devicePrices = priceMap.get(line.deviceId);
        const price = devicePrices?.[rowGrade];
        if (price !== undefined) {
          publicPriceNZD = price * quantity;
          indicativePriceNZD =
            businessEstimateDiscount > 0
              ? calculatePartnerRate(price, businessEstimateDiscount) * quantity
              : publicPriceNZD;
        }

        if (line.deviceId) {
          matchedCount++;
        } else {
          unmatchedCount++;
        }

        totalIndicativeNZD += indicativePriceNZD;
        totalPublicNZD += publicPriceNZD;

        processedLines.push({
          rawInput: line.name,
          deviceId: line.deviceId,
          deviceName: line.name,
          matchConfidence: "exact",
          quantity,
          assumedGrade: rowGrade,
          indicativePriceNZD,
        });
      }
    } else {
      // -----------------------------------------------------------------------
      // Manifest flow: parse CSV and match devices by string
      // -----------------------------------------------------------------------
      const rows = parseManifestRows(csv, validGrades, grade);
      if (!rows) {
        return NextResponse.json(
          { error: "CSV must have at least a header row and one data row" },
          { status: 400 }
        );
      }

      // Pre-load device library for matching
      await loadDeviceLibrary();

      for (const { rawInput, quantity, grade: rowGrade } of rows) {
        // Match device
        const match = await matchDeviceString(rawInput);

        let indicativePriceNZD = 0;
        let publicPriceNZD = 0;
        if (match.deviceId) {
          const devicePrices = priceMap.get(match.deviceId);
          const price = devicePrices?.[rowGrade];
          if (price !== undefined) {
            publicPriceNZD = price * quantity;
            indicativePriceNZD =
              businessEstimateDiscount > 0
                ? calculatePartnerRate(price, businessEstimateDiscount) * quantity
                : publicPriceNZD;
          }
          matchedCount++;
        } else {
          unmatchedCount++;
        }

        totalIndicativeNZD += indicativePriceNZD;
        totalPublicNZD += publicPriceNZD;

        processedLines.push({
          rawInput,
          deviceId: match.deviceId,
          deviceName: match.deviceName,
          matchConfidence: match.matchConfidence,
          quantity,
          assumedGrade: rowGrade,
          indicativePriceNZD,
        });
      }
    }

    if (processedLines.length === 0) {
      return NextResponse.json(
        { error: "No valid device rows found" },
        { status: 400 }
      );
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

    // Create bulk quote document
    const bulkQuoteData: Record<string, unknown> = {
      businessName: businessName || null,
      contactName: null,
      contactEmail: contactEmail || null,
      contactPhone: null,
      type: isBuildList ? "build_list" : "manifest",
      category,
      assumedGrade: grade,
      totalDevices: processedLines.reduce((sum, d) => sum + d.quantity, 0),
      totalIndicativeNZD,
      totalPublicNZD,
      businessEstimateDiscount,
      matchedCount,
      unmatchedCount,
      status: "estimated",
      paymentMethod: null,
      payIdPhone: null,
      bankBSB: null,
      bankAccountNumber: null,
      bankAccountName: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedAt: null,
      receivedAt: null,
      paidAt: null,
    };

    if (partnerId) {
      bulkQuoteData.partnerId = partnerId;
      bulkQuoteData.partnerMode = partnerMode;
    }

    const bulkQuoteRef = await adminDb
      .collection("bulkQuotes")
      .add(bulkQuoteData);

    // Write device lines in batches of 200
    const BATCH_SIZE = 200;
    for (let i = 0; i < processedLines.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = processedLines.slice(i, i + BATCH_SIZE);
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
          actualGrade: null,
          actualPriceNZD: null,
          inspectionNotes: null,
        });
      });
      await batch.commit();
    }

    return NextResponse.json(
      {
        id: bulkQuoteRef.id,
        totalDevices: bulkQuoteData.totalDevices,
        totalIndicativeNZD,
        matchedCount,
        unmatchedCount,
        lineCount: processedLines.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating bulk estimate:", error);
    return NextResponse.json(
      { error: "Failed to create bulk estimate" },
      { status: 500 }
    );
  }
}
