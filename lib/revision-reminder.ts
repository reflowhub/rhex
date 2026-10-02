import { adminDb } from "@/lib/firebase-admin";
import { dueRevisionReminder } from "@/lib/quote-transitions";
import { sendRevisedEmail } from "@/lib/transition-quote";

/**
 * Mode C: send the re-quote reminder if it's due (dueRevisionReminder,
 * 48 hours before the revised offer ends). It's recorded in `remindersSent`
 * inside a transaction before the email goes out, so it's sent at most once.
 * Partners can't switch it off.
 *
 * @returns whether a reminder was claimed and sent
 */
export async function sendRevisionReminder(
  quoteId: string,
  now: Date = new Date()
): Promise<boolean> {
  const quoteRef = adminDb.collection("quotes").doc(quoteId);
  const q = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(quoteRef);
    const data = snap.data();
    if (!data || !dueRevisionReminder(data, now) || typeof data.customerEmail !== "string") {
      return null;
    }
    tx.update(quoteRef, { "remindersSent.revision": now });
    return data;
  });
  if (!q) return false;
  return sendRevisedEmail(quoteId, q, q.customerEmail as string, true);
}
