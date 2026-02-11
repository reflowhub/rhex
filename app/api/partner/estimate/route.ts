import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";
import { matchDeviceString, loadDeviceLibrary } from "@/lib/matching";
import { calculatePartnerRate } from "@/lib/partner-pricing";
import { readGrades } from "@/lib/grades";
import { getActivePriceList, getCategoryGrades } from "@/lib/categories";

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ---------------------------------------------------------------------------
// Column synonyms
// ---------------------------------------------------------------------------

const DEVICE_SYNONYMS = ["device", "model", "phone", "handset", "product", "description", "item", "name"];
const QUANTITY_SYNONYMS = ["quantity", "qty", "count", "units", "amount"];
const STORAGE_SYNONYMS = ["storage", "capacity", "memory", "size", "gb"];
const MAKE_SYNONYMS = ["make", "brand", "manufacturer", "oem"];
const GRADE_SYNONYMS = ["grade", "condition", "quality", "tier"];

function findColumnIndex(headers: string[], synonyms: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const syn of synonyms) {
    const idx = lower.indexOf(syn);
    if (idx !== -1) return idx;
  }
  for (const syn of synonyms) {
    const idx = lower.findIndex((h) => h.includes(syn));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// POST /api/partner/estimate — Create bulk estimate at partner rates (Mode B)
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
    const { csv, assumedGrade, category: bodyCategory } = body;

    if (!csv || typeof csv !== "string") {
      return NextResponse.json(
        { error: "csv is required" },
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

    const discount = partner.partnerRateDiscount ?? 10;

    // Parse CSV
    const lines = csv
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((l: string) => l.trim() !== "");

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have at least a header row and one data row" },
        { status: 400 }
      );
    }

    const headers = parseCSVLine(lines[0]);
    const deviceCol = findColumnIndex(headers, DEVICE_SYNONYMS);
    const quantityCol = findColumnIndex(headers, QUANTITY_SYNONYMS);
    const storageCol = findColumnIndex(headers, STORAGE_SYNONYMS);
    const makeCol = findColumnIndex(headers, MAKE_SYNONYMS);
    const gradeCol = findColumnIndex(headers, GRADE_SYNONYMS);
    const effectiveDeviceCol = deviceCol >= 0 ? deviceCol : 0;

    await loadDeviceLibrary();

    // Lookup active price list for this category
    const priceListId = await getActivePriceList(category);
    if (!priceListId) {
      return NextResponse.json(
        { error: `No pricing available for category "${category}"` },
        { status: 404 }
      );
    }

    interface DeviceLine {
      rawInput: string;
      deviceId: string | null;
      deviceName: string | null;
      matchConfidence: "high" | "medium" | "low" | "manual";
      quantity: number;
      assumedGrade: string;
      indicativePriceNZD: number;
      publicPriceNZD: number;
    }

    const deviceLines: DeviceLine[] = [];
    let totalIndicativeNZD = 0;
    let totalPublicNZD = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    // Fetch price list
    const priceSnapshot = await adminDb
      .collection(`priceLists/${priceListId}/prices`)
      .get();
    const priceMap = new Map<string, Record<string, number>>();
    priceSnapshot.docs.forEach((doc) => {
      priceMap.set(doc.id, readGrades(doc.data()));
    });

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.every((v) => !v.trim())) continue;

      let rawInput = values[effectiveDeviceCol] || "";
      if (makeCol >= 0 && values[makeCol]) rawInput = `${values[makeCol]} ${rawInput}`;
      if (storageCol >= 0 && values[storageCol]) rawInput = `${rawInput} ${values[storageCol]}`;
      rawInput = rawInput.trim();
      if (!rawInput) continue;

      let quantity = 1;
      if (quantityCol >= 0 && values[quantityCol]) {
        const parsed = parseInt(values[quantityCol], 10);
        if (!isNaN(parsed) && parsed > 0) quantity = parsed;
      }

      let rowGrade = grade;
      if (gradeCol >= 0 && values[gradeCol]) {
        const g = values[gradeCol].trim().toUpperCase();
        if (validGrades.includes(g)) rowGrade = g;
      }

      const match = await matchDeviceString(rawInput);

      let publicPrice = 0;
      let partnerPrice = 0;
      if (match.deviceId) {
        const devicePrices = priceMap.get(match.deviceId);
        const price = devicePrices?.[rowGrade];
        if (price !== undefined) {
          publicPrice = price * quantity;
          partnerPrice = calculatePartnerRate(price, discount) * quantity;
        }
        matchedCount++;
      } else {
        unmatchedCount++;
      }

      totalIndicativeNZD += partnerPrice;
      totalPublicNZD += publicPrice;

      deviceLines.push({
        rawInput,
        deviceId: match.deviceId,
        deviceName: match.deviceName,
        matchConfidence: match.matchConfidence,
        quantity,
        assumedGrade: rowGrade,
        indicativePriceNZD: partnerPrice,
        publicPriceNZD: publicPrice,
      });
    }

    if (deviceLines.length === 0) {
      return NextResponse.json(
        { error: "No valid device rows found in CSV" },
        { status: 400 }
      );
    }

    // Create bulk quote document
    const bulkQuoteData: Record<string, unknown> = {
      type: "manifest",
      category,
      assumedGrade: grade,
      totalDevices: deviceLines.reduce((sum, d) => sum + d.quantity, 0),
      totalIndicativeNZD,
      totalPublicNZD,
      matchedCount,
      unmatchedCount,
      status: "estimated",
      partnerId: partner.id,
      partnerMode: "B",
      partnerRateDiscount: discount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedAt: null,
    };

    const bulkQuoteRef = await adminDb.collection("bulkQuotes").add(bulkQuoteData);

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
        lineCount: deviceLines.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating partner estimate:", error);
    return NextResponse.json(
      { error: "Failed to create bulk estimate" },
      { status: 500 }
    );
  }
}
