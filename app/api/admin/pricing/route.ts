import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidateDeviceCache, invalidatePriceCache } from "@/lib/device-cache";
import {
  loadCategories,
  getCategoryGrades,
  invalidateCategoriesCache,
} from "@/lib/categories";
import { logPriceAudit, createPriceSnapshot } from "@/lib/audit-log";

// ---------------------------------------------------------------------------
// CSV Parsing (dynamic grade columns)
// ---------------------------------------------------------------------------

interface PricingRow {
  deviceId: string;
  make: string;
  model: string;
  storage: string;
  grades: Record<string, number>;
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

function parsePricingCSV(
  csv: string,
  gradeKeys: string[]
): {
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

  // Parse header — expected: DeviceID,Make,Model,Storage,<grade keys...>
  const header = lines[0].split(",").map((h) => h.trim());
  const headerLower = header.map((h) => h.toLowerCase());

  const deviceIdIdx = headerLower.indexOf("deviceid");
  const makeIdx = headerLower.indexOf("make");
  const modelIdx = headerLower.indexOf("model");
  const storageIdx = headerLower.indexOf("storage");

  if (deviceIdIdx === -1) {
    errors.push("CSV header must contain a DeviceID column");
  }
  if (makeIdx === -1 || modelIdx === -1 || storageIdx === -1) {
    errors.push("CSV header must contain Make, Model, and Storage columns");
  }

  // Map grade keys to column indices
  const gradeIndices: { key: string; idx: number }[] = [];
  const missingGrades: string[] = [];
  for (const gk of gradeKeys) {
    const idx = headerLower.indexOf(gk.toLowerCase());
    if (idx === -1) {
      missingGrades.push(gk);
    } else {
      gradeIndices.push({ key: gk, idx });
    }
  }
  if (missingGrades.length > 0) {
    errors.push(
      `CSV header must contain grade columns: ${missingGrades.join(", ")}`
    );
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

    const grades: Record<string, number> = {};
    let hasInvalid = false;
    for (const { key, idx } of gradeIndices) {
      const val = parseFloat(fields[idx]?.trim() ?? "");
      if (isNaN(val)) {
        errors.push(
          `Row ${lineNum}: grade ${key} value is not a valid number`
        );
        hasInvalid = true;
        break;
      }
      grades[key] = val;
    }
    if (hasInvalid) continue;

    rows.push({ deviceId, make, model, storage, grades });
  }

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// GET /api/admin/pricing — List all price lists (metadata only)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const snapshot = await adminDb.collection("priceLists").get();

    const priceLists: Record<string, unknown>[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        effectiveDate: data.effectiveDate?.toDate?.()?.toISOString() ?? null,
        currency: data.currency,
        deviceCount: data.deviceCount,
        category: data.category ?? "Phone",
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
// POST /api/admin/pricing — Upload a price list CSV for a category
// Body: { name: string, csv: string, category?: string }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const body = await request.json();
    const { name, csv, category: requestCategory } = body;
    const category = requestCategory || "Phone";

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

    // Load category's grade keys
    const categoryGrades = await getCategoryGrades(category);
    const gradeKeys =
      categoryGrades.length > 0
        ? categoryGrades.map((g) => g.key)
        : ["A", "B", "C", "D", "E"];

    const { rows, errors } = parsePricingCSV(csv, gradeKeys);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid rows found in CSV",
          errors: errors.length > 0 ? errors : ["No valid rows found in CSV"],
        },
        { status: 400 }
      );
    }

    // Check if category already has an active price list
    const categories = await loadCategories();
    const catInfo = categories.find((c) => c.name === category);
    const existingPriceListId = catInfo?.activePriceList ?? null;

    let priceListRef: FirebaseFirestore.DocumentReference;
    let isNewPriceList = false;
    let snapshotId = "";

    if (existingPriceListId) {
      // Overwrite existing price list
      priceListRef = adminDb.collection("priceLists").doc(existingPriceListId);
      const existingDoc = await priceListRef.get();
      if (existingDoc.exists) {
        // Snapshot current prices before overwrite
        snapshotId = await createPriceSnapshot({
          priceListId: existingPriceListId,
          category,
          adminUid: adminUser.uid,
          adminEmail: adminUser.email,
        });

        // Delete all existing prices in batches
        const existingPrices = await priceListRef.collection("prices").get();
        const BATCH_DEL = 200;
        for (let i = 0; i < existingPrices.docs.length; i += BATCH_DEL) {
          const chunk = existingPrices.docs.slice(i, i + BATCH_DEL);
          const batch = adminDb.batch();
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
        // Update the price list metadata
        await priceListRef.update({
          name: name.trim(),
          effectiveDate: admin.firestore.FieldValue.serverTimestamp(),
          deviceCount: rows.length,
          category,
        });
      } else {
        // Active price list reference is stale — create new
        isNewPriceList = true;
        priceListRef = adminDb.collection("priceLists").doc();
      }
    } else {
      // No active price list — create new
      isNewPriceList = true;
      priceListRef = adminDb.collection("priceLists").doc();
    }

    if (isNewPriceList) {
      await priceListRef.set({
        name: name.trim(),
        effectiveDate: admin.firestore.FieldValue.serverTimestamp(),
        currency: "NZD",
        deviceCount: rows.length,
        category,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Set as active price list for this category
      await adminDb.doc("settings/categories").update({
        [`${category}.activePriceList`]: priceListRef.id,
      });
      invalidateCategoriesCache();
    }

    // Build lookups of existing devices to find their doc IDs
    const devicesSnapshot = await adminDb.collection("devices").get();
    const devicesByDeviceId = new Map<string, string>();
    const devicesByMakeModelStorage = new Map<string, string>();
    devicesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const numericId = String(data.deviceId ?? "");
      if (numericId) {
        devicesByDeviceId.set(numericId, doc.id);
      }
      // Secondary lookup by make|model|storage (case-insensitive)
      const key = `${String(data.make ?? "").toLowerCase().trim()}|${String(data.model ?? "").toLowerCase().trim()}|${String(data.storage ?? "").toLowerCase().trim()}`;
      if (key !== "||") {
        devicesByMakeModelStorage.set(key, doc.id);
      }
    });

    // Process in batches of 200
    const BATCH_SIZE = 200;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      for (const row of chunk) {
        // Find device: first by numeric deviceId, then by make|model|storage
        let deviceDocId = devicesByDeviceId.get(row.deviceId);

        if (!deviceDocId) {
          const mmsKey = `${row.make.toLowerCase().trim()}|${row.model.toLowerCase().trim()}|${row.storage.toLowerCase().trim()}`;
          deviceDocId = devicesByMakeModelStorage.get(mmsKey);
          if (deviceDocId) {
            // Update the numeric deviceId on the matched device
            const parsedId = parseInt(row.deviceId, 10) || row.deviceId;
            batch.update(adminDb.collection("devices").doc(deviceDocId), {
              deviceId: parsedId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            devicesByDeviceId.set(row.deviceId, deviceDocId);
          }
        }

        if (!deviceDocId) {
          // Device doesn't exist by either key — create it
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
            category,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          devicesByDeviceId.set(row.deviceId, deviceDocId);
        }

        // Write price entry using the grades map
        const priceRef = priceListRef
          .collection("prices")
          .doc(deviceDocId);
        batch.set(priceRef, { grades: row.grades });
      }

      await batch.commit();
    }

    // Invalidate caches since pricing import may also create new devices
    invalidateDeviceCache();
    invalidatePriceCache();

    // Audit log
    const isOverwrite = !isNewPriceList;
    logPriceAudit({
      adminUid: adminUser.uid,
      adminEmail: adminUser.email,
      action: "csv_upload",
      priceListId: priceListRef.id,
      category,
      summary: `${isOverwrite ? "Replaced" : "Created"} ${name.trim()} (${rows.length} devices)`,
      details: {
        priceListName: name.trim(),
        deviceCount: rows.length,
        snapshotId: snapshotId || null,
        isOverwrite,
      },
    });

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
