import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

interface ParsedRow {
  deviceId?: number;
  make: string;
  model: string;
  storage: string;
}

function parseCSV(csv: string): { rows: ParsedRow[]; hasDeviceId: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    errors.push("CSV is empty");
    return { rows: [], hasDeviceId: false, errors };
  }

  // Parse header
  const header = lines[0].split(",").map((h) => h.trim());
  const headerLower = header.map((h) => h.toLowerCase());

  const hasDeviceId = headerLower.includes("deviceid");
  const makeIdx = headerLower.indexOf("make");
  const modelIdx = headerLower.indexOf("model");
  const storageIdx = headerLower.indexOf("storage");
  const deviceIdIdx = headerLower.indexOf("deviceid");

  if (makeIdx === -1 || modelIdx === -1 || storageIdx === -1) {
    errors.push("CSV header must contain Make, Model, and Storage columns");
    return { rows: [], hasDeviceId, errors };
  }

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const lineNum = i + 1;

    const make = fields[makeIdx]?.trim() ?? "";
    const model = fields[modelIdx]?.trim() ?? "";
    const storage = fields[storageIdx]?.trim() ?? "";

    if (!make || !model || !storage) {
      errors.push(`Row ${lineNum}: missing required field (make, model, or storage)`);
      continue;
    }

    const row: ParsedRow = { make, model, storage };

    if (hasDeviceId && deviceIdIdx !== -1) {
      const rawId = fields[deviceIdIdx]?.trim() ?? "";
      const parsedId = parseInt(rawId, 10);
      if (isNaN(parsedId)) {
        errors.push(`Row ${lineNum}: invalid DeviceID "${rawId}"`);
        continue;
      }
      row.deviceId = parsedId;
    }

    rows.push(row);
  }

  return { rows, hasDeviceId, errors };
}

// Handle quoted CSV fields (e.g. "Galaxy S24, Ultra",128GB)
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote
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

// POST /api/admin/devices/import — Bulk import devices from CSV
export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const body = await request.json();
    const { csv } = body;

    if (!csv || typeof csv !== "string") {
      return NextResponse.json(
        { error: "csv field is required and must be a string" },
        { status: 400 }
      );
    }

    const { rows, hasDeviceId, errors } = parseCSV(csv);

    if (rows.length === 0) {
      return NextResponse.json(
        { imported: 0, errors: errors.length > 0 ? errors : ["No valid rows found in CSV"] },
        { status: 400 }
      );
    }

    let imported = 0;

    // If no DeviceID column, we need to auto-assign IDs starting from the counter
    let nextId: number | null = null;
    if (!hasDeviceId) {
      const counterRef = adminDb.doc("counters/devices");
      await adminDb.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists) {
          nextId = 1;
          transaction.set(counterRef, { nextId: 1 + rows.length });
        } else {
          nextId = counterDoc.data()?.nextId ?? 1;
          transaction.update(counterRef, { nextId: nextId! + rows.length });
        }
      });
    }

    // Process in batches of 200 (each row = 1 write)
    const BATCH_SIZE = 200;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        const deviceId = hasDeviceId ? row.deviceId! : nextId! + i + j;
        const modelStorage = `${row.model} ${row.storage}`;

        const docRef = adminDb.collection("devices").doc();
        batch.set(docRef, {
          deviceId,
          make: row.make,
          model: row.model,
          storage: row.storage,
          modelStorage,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      imported += chunk.length;
    }

    return NextResponse.json({ imported, errors });
  } catch (error) {
    console.error("Error importing devices:", error);
    return NextResponse.json(
      { error: "Failed to import devices" },
      { status: 500 }
    );
  }
}
