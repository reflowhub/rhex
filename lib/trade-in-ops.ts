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

export type PartnerNames = Map<string, string>;

/** Partner names for the quotes' partnerIds, for the ops screens' partner tag. */
export async function loadPartnerNames(quotes: QuoteData[]): Promise<PartnerNames> {
  const ids = Array.from(
    new Set(
      quotes
        .map((q) => q.partnerId)
        .filter((id): id is string => typeof id === "string" && id !== "")
    )
  );
  const map: PartnerNames = new Map();
  if (ids.length === 0) return map;
  const docs = await adminDb.getAll(
    ...ids.map((id) => adminDb.collection("partners").doc(id))
  );
  for (const doc of docs) {
    if (doc.exists) map.set(doc.id, (doc.data()!.name as string) ?? doc.id);
  }
  return map;
}

/**
 * Whether ops screens (queues, Receive Parcel) show a quote. Sandbox quotes
 * are hidden, except Mode C ones, which partners test end to end (labels,
 * receiving, inspection) before going live.
 */
export function isOpsVisible(q: QuoteData): boolean {
  return q.sandbox !== true || q.partnerMode === "C";
}

/** The fields the ops screens show for a quote. */
export function summarizeQuote(
  id: string,
  q: QuoteData,
  devices: DeviceMap,
  partners: PartnerNames = new Map()
) {
  const device = devices.get(q.deviceId as string);
  const partnerResult = q.partnerResult as Record<string, unknown> | undefined;
  return {
    id,
    tradeInRef: (q.tradeInRef as string) ?? null,
    status: q.status as string,
    sandbox: q.sandbox === true,
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
    partnerMode: (q.partnerMode as string) ?? null,
    partnerName: partners.get(q.partnerId as string) ?? null,
    shippingAddress: (q.shippingAddress as string) ?? null,
    customerPhone: (q.customerPhone as string) ?? null,
    /** Mode C: when the partner was sent the final result; the device can't be received after */
    partnerResultSentAt:
      q.partnerMode === "C" && partnerResult
        ? serializeTimestamp(partnerResult.queuedAt)
        : null,
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
    .filter(({ data }) => isOpsVisible(data));
}
