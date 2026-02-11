/**
 * Seed script: loads device library + price list from FP-2B CSV into Firestore.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires .env.local with:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Load env vars from .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    let value = trimmed.slice(eqIndex + 1);
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin env vars. Check .env.local");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();

// CSV path
const CSV_PATH = path.resolve(__dirname, "../docs/2026-01-13 FP-2B.csv");
const PRICE_LIST_ID = "FP-2B";
const BATCH_SIZE = 200; // Each row = 2 writes (device + price), so 200 rows = 400 ops (under 500 limit)

interface DeviceRow {
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

function parseCSV(filePath: string): DeviceRow[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw
    .replace(/^\uFEFF/, "") // strip BOM
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Skip header
  const rows: DeviceRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 9) continue;
    rows.push({
      deviceId: cols[0].trim(),
      make: cols[1].trim(),
      model: cols[2].trim(),
      storage: cols[3].trim(),
      gradeA: parseFloat(cols[4]) || 0,
      gradeB: parseFloat(cols[5]) || 0,
      gradeC: parseFloat(cols[6]) || 0,
      gradeD: parseFloat(cols[7]) || 0,
      gradeE: parseFloat(cols[8]) || 0,
    });
  }
  return rows;
}

async function seed() {
  const rows = parseCSV(CSV_PATH);
  console.log(`Parsed ${rows.length} devices from CSV`);

  const now = admin.firestore.Timestamp.now();
  let maxId = 0;

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + BATCH_SIZE);

    for (const row of chunk) {
      const numId = parseInt(row.deviceId, 10);
      if (numId > maxId) maxId = numId;

      // Write device document
      const deviceRef = db.collection("devices").doc(row.deviceId);
      batch.set(deviceRef, {
        make: row.make,
        model: row.model,
        storage: row.storage,
        modelStorage: `${row.model} ${row.storage}`,
        category: "Phone",
        createdAt: now,
        updatedAt: now,
      });

      // Write price document as subcollection of priceList
      const priceRef = db
        .collection("priceLists")
        .doc(PRICE_LIST_ID)
        .collection("prices")
        .doc(row.deviceId);
      batch.set(priceRef, {
        grades: {
          A: row.gradeA,
          B: row.gradeB,
          C: row.gradeC,
          D: row.gradeD,
          E: row.gradeE,
        },
      });
    }

    await batch.commit();
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: wrote ${chunk.length} devices + prices`);
  }

  // Write price list metadata
  await db
    .collection("priceLists")
    .doc(PRICE_LIST_ID)
    .set({
      name: "FP-2B",
      effectiveDate: admin.firestore.Timestamp.fromDate(new Date("2026-01-13")),
      currency: "NZD",
      deviceCount: rows.length,
      createdAt: now,
    });
  console.log(`Price list "${PRICE_LIST_ID}" metadata written`);

  // Set auto-increment counter
  await db.collection("counters").doc("devices").set({
    nextId: maxId + 1,
  });
  console.log(`Device counter set to ${maxId + 1}`);

  // Seed category definitions
  await db.collection("settings").doc("categories").set({
    Phone: {
      grades: [
        { key: "A", label: "Excellent" },
        { key: "B", label: "Good" },
        { key: "C", label: "Fair" },
        { key: "D", label: "Screen Issues" },
        { key: "E", label: "No Power" },
      ],
    },
  });
  console.log("Category definitions written to settings/categories");

  console.log("\nSeed complete!");
  console.log(`  ${rows.length} devices`);
  console.log(`  ${rows.length} price entries`);
  console.log(`  Next device ID: ${maxId + 1}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
