import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

interface PricingRow {
  deviceId: string;
  make: string;
  model: string;
  storage: string;
  gradeA: number;
  gradeB: number;
  gradeC: number;
  gradeD: number;
  gradeE: number;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parsePricingCSV(csv: string): {
  rows: PricingRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = csv
    .replace(/^\uFEFF/, "") // strip BOM
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    errors.push("CSV is empty");
    return { rows: [], errors };
  }

  // Parse header — expected: DeviceID,Make,Model,Storage,A,B,C,D,E
  const header = lines[0].split(",").map((h) => h.trim());
  const headerLower = header.map((h) => h.toLowerCase());

  const deviceIdIdx = headerLower.indexOf("deviceid");
  const makeIdx = headerLower.indexOf("make");
  const modelIdx = headerLower.indexOf("model");
  const storageIdx = headerLower.indexOf("storage");
  const aIdx = headerLower.indexOf("a");
  const bIdx = headerLower.indexOf("b");
  const cIdx = headerLower.indexOf("c");
  const dIdx = headerLower.indexOf("d");
  const eIdx = headerLower.indexOf("e");

  if (deviceIdIdx === -1) {
    errors.push("CSV header must contain a DeviceID column");
  }
  if (makeIdx === -1 || modelIdx === -1 || storageIdx === -1) {
    errors.push("CSV header must contain Make, Model, and Storage columns");
  }
  if (aIdx === -1 || bIdx === -1 || cIdx === -1 || dIdx === -1 || eIdx === -1) {
    errors.push("CSV header must contain grade columns A, B, C, D, E");
  }

  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const rows: PricingRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const lineNum = i + 1;

    const deviceId = fields[deviceIdIdx]?.trim() ?? "";
    const make = fields[makeIdx]?.trim() ?? "";
    const model = fields[modelIdx]?.trim() ?? "";
    const storage = fields[storageIdx]?.trim() ?? "";

    if (!deviceId) {
      errors.push(`Row ${lineNum}: missing DeviceID`);
      continue;
    }
    if (!make || !model) {
      errors.push(`Row ${lineNum}: missing Make or Model`);
      continue;
    }

    const gradeA = parseFloat(fields[aIdx]?.trim() ?? "");
    const gradeB = parseFloat(fields[bIdx]?.trim() ?? "");
    const gradeC = parseFloat(fields[cIdx]?.trim() ?? "");
    const gradeD = parseFloat(fields[dIdx]?.trim() ?? "");
    const gradeE = parseFloat(fields[eIdx]?.trim() ?? "");

    if ([gradeA, gradeB, gradeC, gradeD, gradeE].some((v) => isNaN(v))) {
      errors.push(`Row ${lineNum}: one or more grade values are not valid numbers`);
      continue;
    }

    rows.push({
      deviceId,
      make,
      model,
      storage,
      gradeA,
      gradeB,
      gradeC,
      gradeD,
      gradeE,
    });
  }

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// GET /api/admin/pricing — List all price lists (metadata only)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const snapshot = await adminDb.collection("priceLists").get();

    const priceLists: Record<string, unknown>[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        effectiveDate: data.effectiveDate?.toDate?.()?.toISOString() ?? null,
        currency: data.currency,
        deviceCount: data.deviceCount,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    // Sort by effectiveDate descending
    priceLists.sort((a, b) => {
      const dateA = a.effectiveDate as string | null;
      const dateB = b.effectiveDate as string | null;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB.localeCompare(dateA);
    });

    return NextResponse.json(priceLists);
  } catch (error) {
    console.error("Error fetching price lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch price lists" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/pricing — Upload a new price list from CSV
// Body: { name: string, csv: string }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, csv } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (!csv || typeof csv !== "string") {
      return NextResponse.json(
        { error: "csv field is required and must be a string" },
        { status: 400 }
      );
    }

    const { rows, errors } = parsePricingCSV(csv);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid rows found in CSV",
          errors: errors.length > 0 ? errors : ["No valid rows found in CSV"],
        },
        { status: 400 }
      );
    }

    // Create the price list document
    const priceListRef = adminDb.collection("priceLists").doc();
    await priceListRef.set({
      name: name.trim(),
      effectiveDate: admin.firestore.FieldValue.serverTimestamp(),
      currency: "NZD",
      deviceCount: rows.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Build a lookup of existing devices by deviceId (numeric) to find their doc IDs
    const devicesSnapshot = await adminDb.collection("devices").get();
    const devicesByDeviceId = new Map<string, string>();
    devicesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const numericId = String(data.deviceId ?? "");
      if (numericId) {
        devicesByDeviceId.set(numericId, doc.id);
      }
    });

    // Process in batches of 200 (each row may need up to 2 writes: price + device)
    const BATCH_SIZE = 200;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      for (const row of chunk) {
        // Find or create the device document
        let deviceDocId = devicesByDeviceId.get(row.deviceId);

        if (!deviceDocId) {
          // Device doesn't exist — create it
          const newDeviceRef = adminDb.collection("devices").doc();
          deviceDocId = newDeviceRef.id;
          const modelStorage = row.storage
            ? `${row.model} ${row.storage}`
            : row.model;
          batch.set(newDeviceRef, {
            deviceId: parseInt(row.deviceId, 10) || row.deviceId,
            make: row.make,
            model: row.model,
            storage: row.storage,
            modelStorage,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          // Track the new device so subsequent rows for the same deviceId reuse it
          devicesByDeviceId.set(row.deviceId, deviceDocId);
        }

        // Write price entry into the subcollection using the device doc ID
        const priceRef = priceListRef
          .collection("prices")
          .doc(deviceDocId);
        batch.set(priceRef, {
          gradeA: row.gradeA,
          gradeB: row.gradeB,
          gradeC: row.gradeC,
          gradeD: row.gradeD,
          gradeE: row.gradeE,
        });
      }

      await batch.commit();
    }

    return NextResponse.json({
      id: priceListRef.id,
      deviceCount: rows.length,
      errors,
    });
  } catch (error) {
    console.error("Error creating price list:", error);
    return NextResponse.json(
      { error: "Failed to create price list" },
      { status: 500 }
    );
  }
}
