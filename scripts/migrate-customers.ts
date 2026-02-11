/**
 * Migrate existing quotes and bulk quotes into the customers collection.
 *
 * Usage:
 *   npx tsx scripts/migrate-customers.ts
 *
 * - Scans all quotes with customerEmail set
 * - Scans all bulkQuotes with contactEmail set
 * - Groups by normalized email, creating one customer per unique email
 * - Writes customerId back to each linked quote/bulkQuote
 * - Idempotent: skips quotes that already have a customerId
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
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
  /\\n/g,
  "\n"
);

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin environment variables in .env.local");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomerDraft {
  type: "individual" | "business";
  name: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  shippingAddress: string | null;
  paymentMethod: string | null;
  payIdPhone: string | null;
  bankBSB: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  quoteIds: string[];
  bulkQuoteIds: string[];
  totalQuotes: number;
  totalValueNZD: number;
  lastActivityAt: string | null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Starting customer migration...\n");

  // Check for existing customers (for idempotency)
  const existingCustomersSnap = await db.collection("customers").get();
  const emailToCustomerId = new Map<string, string>();
  existingCustomersSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.email) {
      emailToCustomerId.set(data.email, doc.id);
    }
  });
  console.log(
    `Found ${emailToCustomerId.size} existing customer records.\n`
  );

  // Fetch all quotes with customer email
  const quotesSnap = await db.collection("quotes").get();
  const bulkQuotesSnap = await db.collection("bulkQuotes").get();

  console.log(`Found ${quotesSnap.size} quotes, ${bulkQuotesSnap.size} bulk quotes.\n`);

  // Build customer map
  const customerMap = new Map<string, CustomerDraft>();

  let quotesProcessed = 0;
  let quotesSkipped = 0;

  for (const doc of quotesSnap.docs) {
    const data = doc.data();

    // Skip if no customer email
    if (!data.customerEmail) continue;

    // Skip if already has customerId
    if (data.customerId) {
      quotesSkipped++;
      continue;
    }

    const email = (data.customerEmail as string).toLowerCase().trim();
    const createdAt = data.createdAt?.toDate?.()?.toISOString() ?? null;

    if (!customerMap.has(email)) {
      customerMap.set(email, {
        type: "individual",
        name: data.customerName || "",
        email,
        phone: data.customerPhone || null,
        businessName: null,
        shippingAddress: data.shippingAddress || null,
        paymentMethod: data.paymentMethod || null,
        payIdPhone: data.payIdPhone || null,
        bankBSB: data.bankBSB || null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankAccountName: data.bankAccountName || null,
        quoteIds: [doc.id],
        bulkQuoteIds: [],
        totalQuotes: 1,
        totalValueNZD: data.quotePriceNZD ?? 0,
        lastActivityAt: createdAt,
      });
    } else {
      const existing = customerMap.get(email)!;
      existing.quoteIds.push(doc.id);
      existing.totalQuotes++;
      existing.totalValueNZD += data.quotePriceNZD ?? 0;

      // Use latest record's contact info
      if (createdAt && (!existing.lastActivityAt || createdAt > existing.lastActivityAt)) {
        existing.lastActivityAt = createdAt;
        if (data.customerName) existing.name = data.customerName;
        if (data.customerPhone) existing.phone = data.customerPhone;
        if (data.shippingAddress) existing.shippingAddress = data.shippingAddress;
        if (data.paymentMethod) {
          existing.paymentMethod = data.paymentMethod;
          existing.payIdPhone = data.payIdPhone || null;
          existing.bankBSB = data.bankBSB || null;
          existing.bankAccountNumber = data.bankAccountNumber || null;
          existing.bankAccountName = data.bankAccountName || null;
        }
      }
    }
    quotesProcessed++;
  }

  let bulkProcessed = 0;
  let bulkSkipped = 0;

  for (const doc of bulkQuotesSnap.docs) {
    const data = doc.data();

    if (!data.contactEmail) continue;

    if (data.customerId) {
      bulkSkipped++;
      continue;
    }

    const email = (data.contactEmail as string).toLowerCase().trim();
    const createdAt = data.createdAt?.toDate?.()?.toISOString() ?? null;

    if (!customerMap.has(email)) {
      customerMap.set(email, {
        type: "business",
        name: data.contactName || "",
        email,
        phone: data.contactPhone || null,
        businessName: data.businessName || null,
        shippingAddress: null,
        paymentMethod: data.paymentMethod || null,
        payIdPhone: data.payIdPhone || null,
        bankBSB: data.bankBSB || null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankAccountName: data.bankAccountName || null,
        quoteIds: [],
        bulkQuoteIds: [doc.id],
        totalQuotes: 1,
        totalValueNZD: data.totalIndicativeNZD ?? 0,
        lastActivityAt: createdAt,
      });
    } else {
      const existing = customerMap.get(email)!;
      existing.bulkQuoteIds.push(doc.id);
      existing.totalQuotes++;
      existing.totalValueNZD += data.totalIndicativeNZD ?? 0;
      existing.type = "business"; // Upgrade to business
      if (data.businessName) existing.businessName = data.businessName;

      if (createdAt && (!existing.lastActivityAt || createdAt > existing.lastActivityAt)) {
        existing.lastActivityAt = createdAt;
        if (data.contactName) existing.name = data.contactName;
        if (data.contactPhone) existing.phone = data.contactPhone;
      }
    }
    bulkProcessed++;
  }

  console.log(`Quotes processed: ${quotesProcessed} (${quotesSkipped} skipped)`);
  console.log(`Bulk quotes processed: ${bulkProcessed} (${bulkSkipped} skipped)`);
  console.log(`Unique customers to create/update: ${customerMap.size}\n`);

  if (customerMap.size === 0) {
    console.log("No new customers to create. Done.");
    process.exit(0);
  }

  // Write customers and backlink quotes in batches
  let created = 0;
  let updated = 0;
  let backlinked = 0;
  const BATCH_SIZE = 200;
  let batch = db.batch();
  let batchCount = 0;

  for (const [email, draft] of customerMap) {
    let customerId: string;

    if (emailToCustomerId.has(email)) {
      // Customer already exists — update
      customerId = emailToCustomerId.get(email)!;
      const ref = db.collection("customers").doc(customerId);
      batch.update(ref, {
        quoteIds: admin.firestore.FieldValue.arrayUnion(...draft.quoteIds),
        bulkQuoteIds: admin.firestore.FieldValue.arrayUnion(
          ...draft.bulkQuoteIds
        ),
        totalQuotes: admin.firestore.FieldValue.increment(draft.totalQuotes),
        totalValueNZD: admin.firestore.FieldValue.increment(
          draft.totalValueNZD
        ),
        lastActivityAt: draft.lastActivityAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      updated++;
    } else {
      // Create new customer
      const ref = db.collection("customers").doc();
      customerId = ref.id;
      batch.set(ref, {
        ...draft,
        notes: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      emailToCustomerId.set(email, customerId);
      created++;
    }

    batchCount++;

    // Backlink quotes
    for (const quoteId of draft.quoteIds) {
      batch.update(db.collection("quotes").doc(quoteId), { customerId });
      backlinked++;
      batchCount++;
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    for (const bulkQuoteId of draft.bulkQuoteIds) {
      batch.update(db.collection("bulkQuotes").doc(bulkQuoteId), {
        customerId,
      });
      backlinked++;
      batchCount++;
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\nMigration complete:`);
  console.log(`  Customers created: ${created}`);
  console.log(`  Customers updated: ${updated}`);
  console.log(`  Quotes backlinked: ${backlinked}`);
  console.log("\nDone.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
