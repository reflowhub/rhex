import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { LABEL_REMINDER_DAYS, POST_BY_DAYS } from "@/lib/label-deadlines";
import type { QuoteStatus } from "@/lib/quote-status";
import { LATE_EXPIRY_GRACE_DAYS } from "@/lib/quote-transitions";
import { sendLabelReminder } from "@/lib/shipping-labels";
import { transitionQuote } from "@/lib/transition-quote";

// ---------------------------------------------------------------------------
// GET|POST /api/cron/quote-expiry — Trade-in deadlines and reminders
//
// Hourly (vercel.json). Every status change goes through transitionQuote
// with actor "system", so each one is re-checked inside a transaction and
// side effects (closing email, label refund queue) run once.
//   - quoted past expiresAt → expired
//   - accepted, label sent, past postByAt + 30 days → expired
//   - revised past revisionExpiresAt → returning (revisionAutoExpired)
//   - day-7 and day-12 label reminders (accepted only; `remindersSent`)
// Vercel Cron sends GET; POST is kept for manual runs.
//
// Auth: Bearer token matching CRON_SECRET env var.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 200;
const CONCURRENCY = 10;
/** Stop starting new pages after this, well inside maxDuration (60s) */
const TIME_BUDGET_MS = 45_000;

type Query = FirebaseFirestore.Query;
type Doc = FirebaseFirestore.QueryDocumentSnapshot;

interface SweepResult {
  matched: number;
  done: number;
  skipped: number;
  /** false if the time budget ran out; the next run picks up the rest */
  complete: boolean;
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const deadline = Date.now() + TIME_BUDGET_MS;
  const quotes = adminDb.collection("quotes");

  const expire = (to: QuoteStatus) => async (doc: Doc) => {
    const result = await transitionQuote(doc.id, to, { actor: "system" });
    if (!result.ok) {
      console.warn(`quote-expiry: ${doc.id} → ${to} skipped: ${result.message}`);
    }
    return result.ok;
  };

  const unaccepted = await sweep(
    quotes
      .where("status", "==", "quoted")
      .where("expiresAt", "<=", now)
      .orderBy("expiresAt"),
    expire("expired"),
    deadline
  );

  const unposted = await sweep(
    quotes
      .where("status", "==", "accepted")
      .where(
        "postByAt",
        "<=",
        new Date(now.getTime() - LATE_EXPIRY_GRACE_DAYS * DAY_MS)
      )
      .orderBy("postByAt"),
    expire("expired"),
    deadline
  );

  const revisions = await sweep(
    quotes
      .where("status", "==", "revised")
      .where("revisionExpiresAt", "<=", now)
      .orderBy("revisionExpiresAt"),
    expire("returning"),
    deadline
  );

  // Labels sent at least FIRST reminder days ago, with postByAt still ahead
  const reminders = await sweep(
    quotes
      .where("status", "==", "accepted")
      .where("postByAt", ">", now)
      .where(
        "postByAt",
        "<=",
        new Date(now.getTime() + (POST_BY_DAYS - LABEL_REMINDER_DAYS[0]) * DAY_MS)
      )
      .orderBy("postByAt"),
    async (doc) => (await sendLabelReminder(doc.id, now)) !== null,
    deadline
  );

  const summary = { unaccepted, unposted, revisions, reminders };
  console.log("quote-expiry:", JSON.stringify(summary));
  return NextResponse.json(summary);
}

/**
 * Run `handle` on every document the query matches, a page at a time.
 * Pages use a cursor, so documents the handler leaves in place (a lost race,
 * a reminder not yet due) aren't fetched again.
 */
async function sweep(
  query: Query,
  handle: (doc: Doc) => Promise<boolean>,
  deadline: number
): Promise<SweepResult> {
  const result: SweepResult = { matched: 0, done: 0, skipped: 0, complete: true };
  let cursor: Doc | null = null;

  for (;;) {
    if (Date.now() > deadline) {
      result.complete = false;
      return result;
    }
    const page: Query = cursor ? query.startAfter(cursor) : query;
    const snap: FirebaseFirestore.QuerySnapshot = await page
      .limit(PAGE_SIZE)
      .get();
    result.matched += snap.size;

    for (let i = 0; i < snap.docs.length; i += CONCURRENCY) {
      const outcomes = await Promise.all(
        snap.docs.slice(i, i + CONCURRENCY).map(async (doc) => {
          try {
            return await handle(doc);
          } catch (err) {
            console.error(`quote-expiry: ${doc.id} failed:`, err);
            return false;
          }
        })
      );
      for (const ok of outcomes) {
        if (ok) result.done++;
        else result.skipped++;
      }
    }

    if (snap.size < PAGE_SIZE) return result;
    cursor = snap.docs[snap.docs.length - 1];
  }
}
