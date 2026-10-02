import { adminDb } from "@/lib/firebase-admin";
import { serializeTimestamp } from "@/lib/serialize";
import type { QuoteData } from "@/lib/quote-transitions";

// ---------------------------------------------------------------------------
// Shared helpers for the trade-in ops screens (queues and receiving)
// ---------------------------------------------------------------------------

export type DeviceMap = Map<string, { make: string; model: string; storage: string }>;

export async function loadDevices(quotes: QuoteData[]): Promise<DeviceMap> {
  const ids = Array.from(
    new Set(
      quotes
        .map((q) => q.deviceId)
        .filter((id): id is string => typeof id === "string" && id !== "")
    )
  );
  const map: DeviceMap = new Map();
  if (ids.length === 0) return map;
  const docs = await adminDb.getAll(
    ...ids.map((id) => adminDb.collection("devices").doc(id))
  );
  for (const doc of docs) {
    if (!doc.exists) continue;
    const d = doc.data()!;
    map.set(doc.id, { make: d.make ?? "", model: d.model ?? "", storage: d.storage ?? "" });
  }
  return map;
}

/** The fields the ops screens show for a quote. */
export function summarizeQuote(id: string, q: QuoteData, devices: DeviceMap) {
  const device = devices.get(q.deviceId as string);
  return {
    id,
    tradeInRef: (q.tradeInRef as string) ?? null,
    status: q.status as string,
    customerName: (q.customerName as string) ?? null,
    customerEmail: (q.customerEmail as string) ?? null,
    device: device ? `${device.make} ${device.model} ${device.storage}`.trim() : "Unknown device",
    grade: (q.grade as string) ?? null,
    imei: (q.imei as string) ?? null,
    trackingNumber: (q.trackingNumber as string) ?? null,
    quotePriceNZD: (q.quotePriceNZD as number) ?? null,
    acceptedAt: serializeTimestamp(q.acceptedAt),
    labelSentAt: serializeTimestamp(q.labelSentAt),
    postByAt: serializeTimestamp(q.postByAt),
    expectedByAt: serializeTimestamp(q.expectedByAt),
  };
}

export type QuoteSummary = ReturnType<typeof summarizeQuote>;

/** Accepted or shipped quotes, the ones a label or parcel can belong to. */
export async function loadOpenTradeIns(): Promise<{ id: string; data: QuoteData }[]> {
  const snap = await adminDb
    .collection("quotes")
    .where("status", "in", ["accepted", "shipped"])
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() }))
    .filter(({ data }) => data.sandbox !== true);
}
