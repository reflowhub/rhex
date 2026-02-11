import { adminDb } from "@/lib/firebase-admin";

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
// Price cache — 5-minute TTL, invalidated on pricing import
// ---------------------------------------------------------------------------

let cachedPrices: Map<string, Record<string, number>> | null = null;
let priceCacheTime = 0;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getPrices(): Promise<Map<string, Record<string, number>>> {
  if (cachedPrices && Date.now() - priceCacheTime < PRICE_CACHE_TTL) {
    return cachedPrices;
  }

  const validGrades = ["A", "B", "C", "D", "E"];
  const snapshot = await adminDb.collection("priceLists/FP-2B/prices").get();
  const priceMap = new Map<string, Record<string, number>>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const grades: Record<string, number> = {};
    for (const g of validGrades) {
      const field = `grade${g}`;
      if (data[field] !== undefined && data[field] !== null) {
        grades[g] = Number(data[field]);
      }
    }
    priceMap.set(doc.id, grades);
  });

  cachedPrices = priceMap;
  priceCacheTime = Date.now();
  return cachedPrices;
}

export function invalidatePriceCache(): void {
  cachedPrices = null;
  priceCacheTime = 0;
}
