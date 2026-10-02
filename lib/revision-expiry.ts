import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { transitionQuote } from "@/lib/transition-quote";
import { updateIfStatus } from "@/lib/status-transition";

/**
 * Apply revision expiry to an already-fetched quote or bulk quote.
 * If the status is "revised" and `revisionExpiresAt` is in the past,
 * auto-transition to "returning" and flag as auto-expired.
 *
 * Call this after any ownership check so callers can only trigger
 * transitions on documents they're allowed to see.
 *
 * @returns the document data, reflecting the transition if one happened
 */
export async function applyRevisionExpiry(
  doc: FirebaseFirestore.DocumentSnapshot
): Promise<FirebaseFirestore.DocumentData | undefined> {
  const data = doc.data();
  if (!data || data.status !== "revised") return data;

  const expiresAt = data.revisionExpiresAt;
  if (!expiresAt) return data;

  const expiryDate = expiresAt.toDate
    ? expiresAt.toDate()
    : new Date(expiresAt);
  if (expiryDate > new Date()) return data;

  // Single quotes go through the transition module
  if (doc.ref.parent.id === "quotes") {
    const result = await transitionQuote(doc.id, "returning", {
      actor: "system",
    });
    if (result.ok) return result.quote;
    // Lost a race with another transition; return what's stored now
    return (await doc.ref.get()).data();
  }

  // Bulk quotes (lib/status-transition.ts)
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
 * Check if a quote's revision has expired, by collection + id.
 *
 * Call this from GET handlers that return quote data so expiry is
 * enforced lazily (no cron required).
 *
 * @returns true if the quote was auto-transitioned
 */
export async function checkRevisionExpiry(
  collection: string,
  docId: string
): Promise<boolean> {
  const doc = await adminDb.collection(collection).doc(docId).get();
  if (!doc.exists) return false;

  const before = doc.data()!;
  const after = await applyRevisionExpiry(doc);
  return before.status !== after?.status;
}
