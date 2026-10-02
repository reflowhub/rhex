import { adminDb } from "@/lib/firebase-admin";
import { DEFAULT_REVISION_RESPONSE_DAYS } from "@/lib/quote-transitions";

/** Global trade-in settings (edited on /admin/settings) */
export const TRADEIN_SETTINGS_DOC = "settings/trade-in";

export const MAX_REVISION_RESPONSE_DAYS = 30;

/** Days a customer has to respond to a revised offer (D3). */
export async function getRevisionResponseDays(): Promise<number> {
  const doc = await adminDb.doc(TRADEIN_SETTINGS_DOC).get();
  const days = doc.data()?.revisionResponseDays;
  return isValidRevisionResponseDays(days)
    ? days
    : DEFAULT_REVISION_RESPONSE_DAYS;
}

export function isValidRevisionResponseDays(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_REVISION_RESPONSE_DAYS
  );
}
