const geoCache = new Map<string, { data: GeoResult; expiry: number }>();
const GEO_TTL = 3_600_000; // 1 hour

export interface GeoResult {
  lat: number;
  lng: number;
  city: string;
  country: string;
  countryCode: string;
}

export function getCachedGeo(ip: string): GeoResult | null {
  const entry = geoCache.get(ip);
  if (!entry || Date.now() > entry.expiry) {
    geoCache.delete(ip);
    return null;
  }
  return entry.data;
}

export function setCachedGeo(ip: string, data: GeoResult): void {
  geoCache.set(ip, { data, expiry: Date.now() + GEO_TTL });
}
