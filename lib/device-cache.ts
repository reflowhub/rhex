import { adminDb } from "@/lib/firebase-admin";
import { readGrades } from "@/lib/grades";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CachedDevice {
  id: string;
  deviceId?: number;
  make: string;
  model: string;
  storage: string;
  modelStorage?: string;
  active: boolean;
  category: string;
}

// ---------------------------------------------------------------------------
// Device cache — 5-minute TTL, invalidated on writes
// ---------------------------------------------------------------------------

let cachedDevices: CachedDevice[] | null = null;
let deviceCacheTime = 0;
const DEVICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getDevices(): Promise<CachedDevice[]> {
  if (cachedDevices && Date.now() - deviceCacheTime < DEVICE_CACHE_TTL) {
    return cachedDevices;
  }

  const snapshot = await adminDb.collection("devices").get();
  cachedDevices = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      deviceId: data.deviceId as number | undefined,
      make: data.make as string,
      model: data.model as string,
      storage: data.storage as string,
      modelStorage: data.modelStorage as string | undefined,
      active: data.active !== false,
      category: (data.category as string) ?? "Phone",
    };
  });
  deviceCacheTime = Date.now();
  return cachedDevices;
}

export function invalidateDeviceCache(): void {
  cachedDevices = null;
  deviceCacheTime = 0;
}

// ---------------------------------------------------------------------------
// Price cache — 5-minute TTL per price list, invalidated on pricing writes
// ---------------------------------------------------------------------------

const priceCache = new Map<
  string,
  { data: Map<string, Record<string, number>>; time: number }
>();
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getPrices(
  priceListId: string = "FP-2B"
): Promise<Map<string, Record<string, number>>> {
  const cached = priceCache.get(priceListId);
  if (cached && Date.now() - cached.time < PRICE_CACHE_TTL) {
    return cached.data;
  }

  const snapshot = await adminDb
    .collection(`priceLists/${priceListId}/prices`)
    .get();
  const priceMap = new Map<string, Record<string, number>>();

  snapshot.docs.forEach((doc) => {
    priceMap.set(doc.id, readGrades(doc.data()));
  });

  priceCache.set(priceListId, { data: priceMap, time: Date.now() });
  return priceMap;
}

export function invalidatePriceCache(): void {
  priceCache.clear();
}
