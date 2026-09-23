/**
 * Delete all quotes and bulk quotes from Firestore.
 *
 * Usage:
 *   npx tsx scripts/delete-quotes.ts
 *
 * Add --dry-run to preview without deleting:
 *   npx tsx scripts/delete-quotes.ts --dry-run
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

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
const dryRun = process.argv.includes("--dry-run");

async function deleteBatch(
  query: FirebaseFirestore.Query,
  label: string
): Promise<number> {
  let total = 0;
  let snapshot = await query.limit(500).get();

  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    total += snapshot.size;

    if (!dryRun) {
      await batch.commit();
    }

    console.log(`  ${dryRun ? "[DRY RUN] Would delete" : "Deleted"} ${total} ${label} so far...`);
    snapshot = await query.limit(500).get();

    // In dry-run mode, break after first batch to avoid infinite loop
    if (dryRun) break;
  }

  return total;
}

async function main() {
  if (dryRun) {
    console.log("=== DRY RUN MODE — no data will be deleted ===\n");
  }

  // 1. Delete all quotes
  console.log("Deleting quotes...");
  const quotesCount = await deleteBatch(db.collection("quotes"), "quotes");
  console.log(`  Total quotes: ${quotesCount}\n`);

  // 2. Delete bulk quotes (subcollection devices first, then parent docs)
  console.log("Deleting bulk quotes...");
  const bulkSnap = await db.collection("bulkQuotes").get();
  let devicesCount = 0;

  for (const doc of bulkSnap.docs) {
    const devCount = await deleteBatch(
      db.collection(`bulkQuotes/${doc.id}/devices`),
      `devices in bulkQuote ${doc.id}`
    );
    devicesCount += devCount;
  }

  const bulkBatch = db.batch();
  bulkSnap.docs.forEach((doc) => bulkBatch.delete(doc.ref));
  const bulkCount = bulkSnap.size;

  if (!dryRun && bulkCount > 0) {
    await bulkBatch.commit();
  }

  console.log(`  Total bulk quotes: ${bulkCount} (with ${devicesCount} device lines)\n`);

  console.log(dryRun ? "Dry run complete." : "Done. All quotes deleted.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
