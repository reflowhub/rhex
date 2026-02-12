const cache = new Map<string, { data: unknown; expiry: number }>();
const TTL = 60_000; // 60 seconds

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiry: Date.now() + TTL });
}
