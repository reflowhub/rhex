/**
 * Copy reference data from production into the test Firebase project.
 *
 * Usage:
 *   npx tsx scripts/copy-prod-to-test.ts            # dry run (counts only)
 *   npx tsx scripts/copy-prod-to-test.ts --write    # copy
 *
 * Source credentials: .env.prod.local (production, read-only use)
 * Target credentials: .env.local      (must NOT be production)
 *
 * Copies: settings, counters, devices, deviceAliases, priceLists (+ prices),
 * upsellProducts, exchangeRates, and listed inventory with its imageBlobs.
 * Never copies customer data (quotes, bulkQuotes, customers, orders,
 * partners, apiKeys, commissionLedger, payouts, ...).
 *
 * Existing target documents with the same ID are overwritten.
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const PRODUCTION_PROJECT_ID = "marco-aeb51";
const WRITE = process.argv.includes("--write");

function readEnvFile(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  const content = fs.readFileSync(path.resolve(__dirname, "..", file), "utf-8");
  for (const line of content.split("\n")) {
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
    env[key] = value;
  }
  return env;
}

function initApp(file: string, name: string) {
  const env = readEnvFile(file);
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
  const app = admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      projectId,
    },
    name
  );
  return { db: app.firestore(), projectId };
}

const source = initApp(".env.prod.local", "source");
const target = initApp(".env.local", "target");

if (
  target.projectId === PRODUCTION_PROJECT_ID ||
  target.projectId === source.projectId
) {
  console.error(
    `Refusing to run: target project is "${target.projectId}". .env.local must point at the test project.`
  );
  process.exit(1);
}

type Db = FirebaseFirestore.Firestore;
type Doc = FirebaseFirestore.QueryDocumentSnapshot;

let pending: { path: string; data: FirebaseFirestore.DocumentData }[] = [];
let written = 0;

async function flush(db: Db) {
  if (!WRITE || pending.length === 0) {
    pending = [];
    return;
  }
  const batch = db.batch();
  for (const p of pending) batch.set(db.doc(p.path), p.data);
  await batch.commit();
  written += pending.length;
  pending = [];
}

async function queue(path: string, data: FirebaseFirestore.DocumentData) {
  pending.push({ path, data });
  if (pending.length >= 400) await flush(target.db);
}

async function copyDocs(label: string, docs: Doc[], transform?: (d: Doc) => FirebaseFirestore.DocumentData) {
  for (const doc of docs) {
    await queue(doc.ref.path, transform ? transform(doc) : doc.data());
  }
  await flush(target.db);
  console.log(`${label}: ${docs.length}`);
}

async function copyCollection(name: string) {
  const snap = await source.db.collection(name).get();
  await copyDocs(name, snap.docs);
  return snap.docs;
}

async function main() {
  console.log(
    `${WRITE ? "Copying" : "Dry run"}: ${source.projectId} -> ${target.projectId}\n`
  );

  for (const name of [
    "settings",
    "counters",
    "devices",
    "deviceAliases",
    "upsellProducts",
    "exchangeRates",
  ]) {
    await copyCollection(name);
  }

  // Price lists and their prices subcollections
  const priceLists = await copyCollection("priceLists");
  let priceCount = 0;
  for (const list of priceLists) {
    const prices = await list.ref.collection("prices").get();
    for (const doc of prices.docs) await queue(doc.ref.path, doc.data());
    priceCount += prices.size;
  }
  await flush(target.db);
  console.log(`priceLists/*/prices: ${priceCount}`);

  // Listed inventory only, without free-text notes or trade-in links
  const inventory = await source.db
    .collection("inventory")
    .where("status", "==", "listed")
    .get();
  await copyDocs("inventory (listed)", inventory.docs, (doc) => ({
    ...doc.data(),
    notes: "",
    sourceQuoteId: null,
  }));

  // Image blobs referenced by those inventory items (/api/images/{id})
  const blobIds = new Set<string>();
  for (const doc of inventory.docs) {
    const json = JSON.stringify(doc.data());
    for (const m of json.matchAll(/\/api\/images\/([A-Za-z0-9]+)/g)) {
      blobIds.add(m[1]);
    }
  }
  let blobCount = 0;
  for (const id of blobIds) {
    const blob = await source.db.collection("imageBlobs").doc(id).get();
    if (!blob.exists) continue;
    await queue(blob.ref.path, blob.data()!);
    blobCount++;
    // Blobs are large; write them in small batches
    if (pending.length >= 10) await flush(target.db);
  }
  await flush(target.db);
  console.log(`imageBlobs: ${blobCount}`);

  console.log(
    WRITE ? `\nDone. ${written} documents written.` : "\nDry run only. Re-run with --write to copy."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
