/**
 * One-off migration for Phase 3 of docs/TRADEIN-STATES-PLAN.md: moves
 * `quoted` quotes past their expiresAt to `expired` through the transition
 * module (actor "system"; no emails or other side effects for this move).
 *
 * Reported but left alone:
 *   - accepted quotes without a label (they stay in "Awaiting label")
 *   - stale `revised` quotes and unposted accepted quotes past
 *     postByAt + 30 days (the quote-expiry cron moves these, with emails)
 *
 * Usage:
 *   npx tsx scripts/migrate-quote-expiry.ts                  # dry run, .env.local
 *   npx tsx scripts/migrate-quote-expiry.ts --write          # migrate, .env.local
 *   npx tsx scripts/migrate-quote-expiry.ts --prod [--write] # .env.prod.local
 *
 * Safe to rerun: each move is re-checked inside a transaction, and a second
 * dry run finds nothing to migrate.
 */

import { loadEnv } from "./load-env";

const WRITE = process.argv.includes("--write");
const CONCURRENCY = 10;
loadEnv(process.argv.includes("--prod") ? ".env.prod.local" : ".env.local");

async function main() {
  const { adminDb } = await import("../lib/firebase-admin");
  const { transitionQuote } = await import("../lib/transition-quote");
  const { dueSystemTransition, toDate } = await import("../lib/quote-transitions");

  const now = new Date();
  console.log(
    `Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}${WRITE ? "" : " — dry run"}`
  );

  // Status-only queries, so this runs before the new indexes are built
  const [quoted, accepted, revised] = await Promise.all(
    ["quoted", "accepted", "revised"].map((status) =>
      adminDb.collection("quotes").where("status", "==", status).get()
    )
  );

  const toExpire = quoted.docs.filter(
    (doc) => dueSystemTransition(doc.data(), now) === "expired"
  );
  const awaitingLabel = accepted.docs.filter((doc) => !doc.data().labelId);
  const unposted = accepted.docs.filter(
    (doc) => dueSystemTransition(doc.data(), now) === "expired"
  );
  const staleRevisions = revised.docs.filter(
    (doc) => dueSystemTransition(doc.data(), now) === "returning"
  );

  console.log(
    `quoted: ${quoted.size}, ${toExpire.length} past expiresAt → expired`
  );
  let moved = 0;
  for (let i = 0; i < toExpire.length; i += CONCURRENCY) {
    await Promise.all(
      toExpire.slice(i, i + CONCURRENCY).map(async (doc) => {
        const expiresAt = toDate(doc.data().expiresAt)?.toISOString() ?? "?";
        if (!WRITE) {
          console.log(`  ${doc.id}  expired at ${expiresAt}`);
          return;
        }
        const result = await transitionQuote(doc.id, "expired", {
          actor: "system",
        });
        if (result.ok) moved++;
        console.log(
          `  ${doc.id}  expired at ${expiresAt}  ${result.ok ? "moved" : `skipped: ${result.message}`}`
        );
      })
    );
  }

  console.log(
    `accepted: ${accepted.size}, ${awaitingLabel.length} awaiting a label (left in "Awaiting label")`
  );
  console.log(
    `accepted, unposted past postByAt + 30 days: ${unposted.length} (left for the cron)`
  );
  console.log(
    `revised past revisionExpiresAt: ${staleRevisions.length} (left for the cron)`
  );
  for (const doc of [...unposted, ...staleRevisions]) {
    console.log(`  ${doc.id}  ${doc.data().status}`);
  }

  if (WRITE) {
    console.log(`\nMoved ${moved} of ${toExpire.length} quotes to expired.`);
  } else if (toExpire.length > 0) {
    console.log("\nDry run only. Rerun with --write to expire these quotes.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
