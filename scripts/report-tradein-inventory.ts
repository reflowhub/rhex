/**
 * One-off report for Phase 4 of docs/TRADEIN-STATES-PLAN.md (finding 8).
 * Read-only. Inventory receive used to accept trade-ins at `received`,
 * before inspection, at the original quote price. This lists trade-in
 * inventory items whose quote:
 *   - is not yet `inspected` or `paid` (e.g. still `received`)
 *   - has a costNZD that differs from the amount payable (a revision was
 *     accepted after the item was created)
 *   - no longer exists
 *
 * Usage:
 *   npx tsx scripts/report-tradein-inventory.ts          # .env.local
 *   npx tsx scripts/report-tradein-inventory.ts --prod   # .env.prod.local
 */

import { loadEnv } from "./load-env";

loadEnv(process.argv.includes("--prod") ? ".env.prod.local" : ".env.local");

const RECEIVABLE = ["inspected", "paid"];

async function main() {
  const { adminDb } = await import("../lib/firebase-admin");
  const { payableAmount } = await import("../lib/quote-money");

  console.log(`Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  const items = await adminDb
    .collection("inventory")
    .where("sourceType", "==", "trade-in")
    .get();
  console.log(`Trade-in inventory items: ${items.size}`);
  if (items.empty) return;

  const quoteIds = Array.from(
    new Set(
      items.docs
        .map((d) => d.data().sourceQuoteId as string | undefined)
        .filter((id): id is string => !!id)
    )
  );
  const quoteDocs = quoteIds.length
    ? await adminDb.getAll(
        ...quoteIds.map((id) => adminDb.collection("quotes").doc(id))
      )
    : [];
  const quotes = new Map(
    quoteDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!])
  );

  const early: string[] = [];
  const costMismatch: string[] = [];
  const missing: string[] = [];

  for (const doc of items.docs) {
    const item = doc.data();
    const label = `#${item.inventoryId} (${doc.id}) serial ${item.serial} status ${item.status}`;
    const q = quotes.get(item.sourceQuoteId);
    if (!q) {
      missing.push(`  ${label}  quote ${item.sourceQuoteId ?? "—"}`);
      continue;
    }
    if (!RECEIVABLE.includes(q.status)) {
      early.push(`  ${label}  quote ${item.sourceQuoteId} is ${q.status}`);
    }
    const payableNZD = payableAmount(q).amountNZD;
    if (Number(item.costNZD) !== payableNZD) {
      costMismatch.push(
        `  ${label}  costNZD ${item.costNZD} vs payable ${payableNZD} (quote ${q.status})`
      );
    }
  }

  const section = (title: string, rows: string[]) => {
    console.log(`\n${title}: ${rows.length}`);
    for (const row of rows) console.log(row);
  };
  section("Quote not yet inspected or paid", early);
  section("costNZD differs from the amount payable", costMismatch);
  section("Source quote missing", missing);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
