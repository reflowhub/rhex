import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { matchDeviceString, loadDeviceLibrary } from "@/lib/matching";

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields) — same pattern as admin device import
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
// Column synonyms for auto-detection
// ---------------------------------------------------------------------------

const DEVICE_SYNONYMS = [
  "device",
  "model",
  "phone",
  "handset",
  "product",
  "description",
  "item",
  "name",
];
const QUANTITY_SYNONYMS = ["quantity", "qty", "count", "units", "amount"];
const STORAGE_SYNONYMS = ["storage", "capacity", "memory", "size", "gb"];
const MAKE_SYNONYMS = ["make", "brand", "manufacturer", "oem"];

function findColumnIndex(
  headers: string[],
  synonyms: string[]
): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const syn of synonyms) {
    const idx = lower.indexOf(syn);
    if (idx !== -1) return idx;
  }
  // Partial match
  for (const syn of synonyms) {
    const idx = lower.findIndex((h) => h.includes(syn));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// POST /api/business/estimate — Create a bulk estimate from manifest CSV
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csv, assumedGrade, businessName, contactEmail } = body;

    if (!csv || typeof csv !== "string") {
      return NextResponse.json(
        { error: "csv is required" },
        { status: 400 }
      );
    }

    // Validate grade
    const validGrades = ["A", "B", "C", "D", "E"];
    const grade = (assumedGrade || "C").toUpperCase();
    if (!validGrades.includes(grade)) {
      return NextResponse.json(
        { error: "assumedGrade must be A, B, C, D, or E" },
        { status: 400 }
      );
    }

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

    // Auto-detect columns
    const deviceCol = findColumnIndex(headers, DEVICE_SYNONYMS);
    const quantityCol = findColumnIndex(headers, QUANTITY_SYNONYMS);
    const storageCol = findColumnIndex(headers, STORAGE_SYNONYMS);
    const makeCol = findColumnIndex(headers, MAKE_SYNONYMS);

    // If no device column found, use the first column
    const effectiveDeviceCol = deviceCol >= 0 ? deviceCol : 0;

    // Pre-load device library for matching
    await loadDeviceLibrary();

    // Process each row
    interface DeviceLine {
      rawInput: string;
      deviceId: string | null;
      deviceName: string | null;
      matchConfidence: "high" | "medium" | "low" | "manual";
      quantity: number;
      assumedGrade: string;
      indicativePriceNZD: number;
    }

    const deviceLines: DeviceLine[] = [];
    let totalIndicativeNZD = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    // Fetch price list for pricing lookups
    const priceSnapshot = await adminDb
      .collection("priceLists/FP-2B/prices")
      .get();
    const priceMap = new Map<string, number>();
    priceSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const gradeField = `grade${grade}`;
      if (data[gradeField] !== undefined && data[gradeField] !== null) {
        priceMap.set(doc.id, Number(data[gradeField]));
      }
    });

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.every((v) => !v.trim())) continue; // skip empty rows

      // Build raw input string
      let rawInput = values[effectiveDeviceCol] || "";
      if (makeCol >= 0 && values[makeCol]) {
        rawInput = `${values[makeCol]} ${rawInput}`;
      }
      if (storageCol >= 0 && values[storageCol]) {
        rawInput = `${rawInput} ${values[storageCol]}`;
      }
      rawInput = rawInput.trim();

      if (!rawInput) continue;

      // Parse quantity
      let quantity = 1;
      if (quantityCol >= 0 && values[quantityCol]) {
        const parsed = parseInt(values[quantityCol], 10);
        if (!isNaN(parsed) && parsed > 0) quantity = parsed;
      }

      // Match device
      const match = await matchDeviceString(rawInput);

      let indicativePriceNZD = 0;
      if (match.deviceId) {
        const price = priceMap.get(match.deviceId);
        if (price !== undefined) {
          indicativePriceNZD = price * quantity;
        }
        matchedCount++;
      } else {
        unmatchedCount++;
      }

      totalIndicativeNZD += indicativePriceNZD;

      deviceLines.push({
        rawInput,
        deviceId: match.deviceId,
        deviceName: match.deviceName,
        matchConfidence: match.matchConfidence,
        quantity,
        assumedGrade: grade,
        indicativePriceNZD,
      });
    }

    if (deviceLines.length === 0) {
      return NextResponse.json(
        { error: "No valid device rows found in CSV" },
        { status: 400 }
      );
    }

    // Create bulk quote document
    const bulkQuoteData = {
      businessName: businessName || null,
      contactName: null,
      contactEmail: contactEmail || null,
      contactPhone: null,
      type: "manifest",
      assumedGrade: grade,
      totalDevices: deviceLines.reduce((sum, d) => sum + d.quantity, 0),
      totalIndicativeNZD,
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

    const bulkQuoteRef = await adminDb
      .collection("bulkQuotes")
      .add(bulkQuoteData);

    // Write device lines in batches of 200
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
        lineCount: deviceLines.length,
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
