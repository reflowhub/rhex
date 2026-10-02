/**
 * Assign sequential TI- references to trade-in quotes that were accepted
 * before references existed, oldest acceptance first. New acceptances get
 * one from lib/transition-quote.ts using the same counter (counters/tradeIns).
 *
 * Usage:
 *   npx tsx scripts/backfill-tradein-refs.ts                  # dry run, .env.local
 *   npx tsx scripts/backfill-tradein-refs.ts --write          # assign, .env.local
 *   npx tsx scripts/backfill-tradein-refs.ts --prod [--write] # .env.prod.local
 *
 * Skips sandbox quotes and quotes that already have a reference. Safe to
 * rerun: each assignment re-checks the quote inside a transaction.
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { formatTradeInRef } from "../lib/quote-status";

const WRITE = process.argv.includes("--write");
const ENV_FILE = process.argv.includes("--prod") ? ".env.prod.local" : ".env.local";
const FIRST_TRADE_IN_NUMBER = 1001;

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

const env = readEnvFile(ENV_FILE);
const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
  projectId,
});
const db = admin.firestore();

function millis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as admin.firestore.Timestamp).toMillis();
  }
  return Number.MAX_SAFE_INTEGER;
}

async function main() {
  console.log(`Project: ${projectId} (${ENV_FILE})${WRITE ? "" : " — dry run"}`);

  // Every quote that got past acceptance has acceptedAt
  const snapshot = await db
    .collection("quotes")
    .where("acceptedAt", "!=", null)
    .get();

  const pending = snapshot.docs
    .filter((doc) => !doc.data().tradeInRef && doc.data().sandbox !== true)
    .sort((a, b) => millis(a.data().acceptedAt) - millis(b.data().acceptedAt));

  console.log(
    `${snapshot.size} accepted quotes, ${pending.length} without a reference`
  );

  const counterRef = db.doc("counters/tradeIns");
  let preview =
    ((await counterRef.get()).data()?.nextId as number | undefined) ??
    FIRST_TRADE_IN_NUMBER;

  for (const doc of pending) {
    const data = doc.data();
    const accepted = data.acceptedAt?.toDate?.().toISOString() ?? "?";

    if (!WRITE) {
      console.log(
        `  ${formatTradeInRef(preview++)}  ${doc.id}  ${data.status}  accepted ${accepted}`
      );
      continue;
    }

    const ref = await db.runTransaction(async (tx) => {
      const [fresh, counter] = await Promise.all([
        tx.get(doc.ref),
        tx.get(counterRef),
      ]);
      if (fresh.data()?.tradeInRef) return null;
      const n =
        (counter.data()?.nextId as number | undefined) ?? FIRST_TRADE_IN_NUMBER;
      const tradeInRef = formatTradeInRef(n);
      tx.set(counterRef, { nextId: n + 1 }, { merge: true });
      tx.update(doc.ref, { tradeInRef });
      return tradeInRef;
    });
    console.log(
      `  ${ref ?? "(already set)"}  ${doc.id}  ${data.status}  accepted ${accepted}`
    );
  }

  if (!WRITE && pending.length > 0) {
    console.log("\nDry run only. Rerun with --write to assign these references.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
