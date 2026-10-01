import { adminDb } from "@/lib/firebase-admin";

/**
 * Apply `update` only if the document's status is still `expectedStatus`,
 * re-checked inside a transaction so concurrent requests can't both
 * transition the same document.
 *
 * @returns true if this call made the update
 */
export async function updateIfStatus(
  ref: FirebaseFirestore.DocumentReference,
  expectedStatus: string,
  update: Record<string, unknown>
): Promise<boolean> {
  return adminDb.runTransaction(async (transaction) => {
    const fresh = await transaction.get(ref);
    if (fresh.data()?.status !== expectedStatus) return false;
    transaction.update(ref, update);
    return true;
  });
}
