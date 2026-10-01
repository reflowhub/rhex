import { serializeTimestamp } from "@/lib/serialize";

/**
 * Build the public v1 API representation of a bulk quote, including its
 * device lines.
 */
export async function serializeV1BulkQuote(
  ref: FirebaseFirestore.DocumentReference,
  data: FirebaseFirestore.DocumentData
): Promise<Record<string, unknown>> {
  const devicesSnapshot = await ref.collection("devices").get();
  const devices = devicesSnapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  return {
    id: ref.id,
    type: data.type,
    category: data.category ?? null,
    assumedGrade: data.assumedGrade,
    totalDevices: data.totalDevices,
    totalIndicativeNZD: data.totalIndicativeNZD,
    totalPublicNZD: data.totalPublicNZD ?? null,
    totalIndicative: data.totalIndicativeDisplay ?? data.totalIndicativeNZD,
    totalPublic: data.totalPublicDisplay ?? data.totalPublicNZD ?? null,
    displayCurrency: data.displayCurrency ?? "NZD",
    matchedCount: data.matchedCount,
    unmatchedCount: data.unmatchedCount,
    status: data.status,
    source: data.source ?? null,
    revisedTotalNZD: data.revisedTotalNZD ?? null,
    createdAt: serializeTimestamp(data.createdAt),
    acceptedAt: serializeTimestamp(data.acceptedAt),
    revisedAt: serializeTimestamp(data.revisedAt),
    revisionExpiresAt: serializeTimestamp(data.revisionExpiresAt),
    returningAt: serializeTimestamp(data.returningAt),
    returnedAt: serializeTimestamp(data.returnedAt),
    devices,
  };
}
