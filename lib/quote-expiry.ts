import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { dueSystemTransition } from "@/lib/quote-transitions";
import { transitionQuote } from "@/lib/transition-quote";
import { updateIfStatus } from "@/lib/status-transition";

/**
 * Apply any deadline that has passed to an already-fetched quote or bulk
 * quote. Single quotes: quoted/accepted → expired and revised → returning,
 * through the transition module. Bulk quotes: revised → returning.
 *
 * The hourly cron (/api/cron/quote-expiry) is the main trigger; this is the
 * backstop for a quote opened before the cron reaches it.
 *
 * Call this after any ownership check so callers can only trigger
 * transitions on documents they're allowed to see.
 *
 * @returns the document data, reflecting the transition if one happened
 */
export async function applyQuoteExpiry(
  doc: FirebaseFirestore.DocumentSnapshot
): Promise<FirebaseFirestore.DocumentData | undefined> {
  const data = doc.data();
  if (!data) return data;

  // Single quotes go through the transition module
  if (doc.ref.parent.id === "quotes") {
    const to = dueSystemTransition(data);
    if (!to) return data;
    const result = await transitionQuote(doc.id, to, { actor: "system" });
    if (result.ok) return result.quote;
    // Lost a race with another transition; return what's stored now
    return (await doc.ref.get()).data();
  }

  // Bulk quotes (lib/status-transition.ts)
  if (data.status !== "revised" || !data.revisionExpiresAt) return data;
  const expiresAt = data.revisionExpiresAt;
  const expiryDate = expiresAt.toDate
    ? expiresAt.toDate()
    : new Date(expiresAt);
  if (expiryDate > new Date()) return data;

  const moved = await updateIfStatus(doc.ref, "revised", {
    status: "returning",
    returningAt: admin.firestore.FieldValue.serverTimestamp(),
    revisionAutoExpired: true,
  });
  if (!moved) return (await doc.ref.get()).data();

  return {
    ...data,
    status: "returning",
    returningAt: admin.firestore.Timestamp.now(),
    revisionAutoExpired: true,
  };
}

/**
 * Apply any passed deadline to a quote, by collection + id.
 *
 * @returns true if the quote was auto-transitioned
 */
export async function checkQuoteExpiry(
  collection: string,
  docId: string
): Promise<boolean> {
  const doc = await adminDb.collection(collection).doc(docId).get();
  if (!doc.exists) return false;

  const before = doc.data()!;
  const after = await applyQuoteExpiry(doc);
  return before.status !== after?.status;
}
