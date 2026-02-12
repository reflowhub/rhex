/**
 * One-time cleanup: removes duplicate devices created by price list uploads.
 * For each make|model|storage group with multiple docs, keeps the one with a
 * numeric deviceId and deletes the others — migrating any price entries first.
 *
 * Usage:
 *   npx tsx scripts/dedupe-devices.ts          # dry-run (default)
 *   npx tsx scripts/dedupe-devices.ts --apply   # actually delete
 *
 * Requires .env.local with Firebase Admin credentials.
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// --- Load .env.local ---
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// --- Init Firebase ---
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
  /\\n/g,
  "\n"
);

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin env vars. Check .env.local");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();
const dryRun = !process.argv.includes("--apply");

async function dedupeDevices() {
  if (dryRun) {
    console.log("=== DRY RUN (pass --apply to delete) ===\n");
  }

  // 1. Load all devices
  const devicesSnap = await db.collection("devices").get();
  console.log(`Total devices: ${devicesSnap.size}`);

  // 2. Group by make|model|storage
  const groups = new Map<
    string,
    { id: string; deviceId: unknown; createdAt: unknown }[]
  >();

  for (const doc of devicesSnap.docs) {
    const d = doc.data();
    const key = `${String(d.make ?? "").toLowerCase().trim()}|${String(d.model ?? "").toLowerCase().trim()}|${String(d.storage ?? "").toLowerCase().trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      id: doc.id,
      deviceId: d.deviceId,
      createdAt: d.createdAt,
    });
  }

  // 3. Find duplicates
  const toDelete: string[] = [];
  const remap = new Map<string, string>(); // oldDocId -> keepDocId

  for (const [key, docs] of groups) {
    if (docs.length <= 1) continue;

    // Prefer the doc with a numeric deviceId; tie-break by earliest createdAt
    const sorted = docs.sort((a, b) => {
      const aNumeric = typeof a.deviceId === "number" ? 0 : 1;
      const bNumeric = typeof b.deviceId === "number" ? 0 : 1;
      if (aNumeric !== bNumeric) return aNumeric - bNumeric;
      // Both same type — keep the one with the lower numeric deviceId
      if (typeof a.deviceId === "number" && typeof b.deviceId === "number") {
        return a.deviceId - b.deviceId;
      }
      return 0;
    });

    const keep = sorted[0];
    const dupes = sorted.slice(1);

    console.log(
      `\nDuplicate group: ${key} (${docs.length} docs)` +
        `\n  KEEP:   ${keep.id} (deviceId=${keep.deviceId})` +
        dupes
          .map((d) => `\n  DELETE: ${d.id} (deviceId=${d.deviceId})`)
          .join("")
    );

    for (const d of dupes) {
      toDelete.push(d.id);
      remap.set(d.id, keep.id);
    }
  }

  if (toDelete.length === 0) {
    console.log("\nNo duplicates found.");
    return;
  }

  console.log(`\n${toDelete.length} duplicate device(s) to remove.`);

  // 4. Load all price lists and migrate price entries
  const priceListsSnap = await db.collection("priceLists").get();
  let migratedCount = 0;

  for (const plDoc of priceListsSnap.docs) {
    const pricesSnap = await plDoc.ref.collection("prices").get();

    for (const priceDoc of pricesSnap.docs) {
      const newDeviceDocId = remap.get(priceDoc.id);
      if (!newDeviceDocId) continue;

      // Check if the keep device already has a price entry
      const existingPrice = await plDoc.ref
        .collection("prices")
        .doc(newDeviceDocId)
        .get();

      if (!existingPrice.exists) {
        // Migrate: copy price data to the kept device's doc ID
        console.log(
          `  Migrate price: ${plDoc.id}/prices/${priceDoc.id} -> ${newDeviceDocId}`
        );
        if (!dryRun) {
          await plDoc.ref
            .collection("prices")
            .doc(newDeviceDocId)
            .set(priceDoc.data());
        }
        migratedCount++;
      }

      // Delete the old price entry
      console.log(`  Delete price: ${plDoc.id}/prices/${priceDoc.id}`);
      if (!dryRun) {
        await priceDoc.ref.delete();
      }
    }
  }

  console.log(`\nMigrated ${migratedCount} price entries.`);

  // 5. Delete duplicate device docs
  const BATCH_SIZE = 200;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const docId of chunk) {
      batch.delete(db.collection("devices").doc(docId));
    }
    if (!dryRun) {
      await batch.commit();
    }
    console.log(
      `${dryRun ? "Would delete" : "Deleted"} ${chunk.length} device doc(s).`
    );
  }

  console.log("\nDone!");
}

dedupeDevices().catch((err) => {
  console.error(err);
  process.exit(1);
});
