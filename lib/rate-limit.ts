// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 300; // per window (default for partner API keys)

const store = new Map<string, number[]>();
let callCount = 0;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export function checkRateLimit(
  keyId: string,
  maxRequests: number = MAX_REQUESTS,
  windowMs: number = WINDOW_MS
): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup — every 100 calls, prune stale entries
  callCount++;
  if (callCount % 100 === 0) {
    for (const [k, timestamps] of store) {
      const filtered = timestamps.filter((t) => now - t < WINDOW_MS);
      if (filtered.length === 0) {
        store.delete(k);
      } else {
        store.set(k, filtered);
      }
    }
  }

  let timestamps = store.get(keyId);
  if (!timestamps) {
    timestamps = [];
    store.set(keyId, timestamps);
  }

  // Remove timestamps outside the window
  const windowStart = now - windowMs;
  while (timestamps.length > 0 && timestamps[0] < windowStart) {
    timestamps.shift();
  }

  if (timestamps.length >= maxRequests) {
    // Oldest timestamp in window — calculate when it will expire
    const retryAfter = Math.ceil((timestamps[0] + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  timestamps.push(now);
  return { allowed: true };
}

/** Extract client IP from Vercel's x-forwarded-for header. */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
