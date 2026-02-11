import { adminDb } from "@/lib/firebase-admin";

/**
 * Check if a device with the same make+model+storage already exists (case-insensitive).
 * Returns the duplicate device info if found, or null if no duplicate.
 */
export async function findDuplicateDevice(
  make: string,
  model: string,
  storage: string,
  excludeDocId?: string
): Promise<{ id: string; make: string; model: string; storage: string } | null> {
  const snapshot = await adminDb.collection("devices").get();

  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();
  const normalizedStorage = storage.toLowerCase().trim();

  for (const doc of snapshot.docs) {
    if (excludeDocId && doc.id === excludeDocId) continue;

    const data = doc.data();
    if (
      String(data.make ?? "").toLowerCase().trim() === normalizedMake &&
      String(data.model ?? "").toLowerCase().trim() === normalizedModel &&
      String(data.storage ?? "").toLowerCase().trim() === normalizedStorage
    ) {
      return {
        id: doc.id,
        make: data.make as string,
        model: data.model as string,
        storage: data.storage as string,
      };
    }
  }

  return null;
}
