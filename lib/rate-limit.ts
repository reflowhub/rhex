// ---------------------------------------------------------------------------
// Firestore-backed fixed-window rate limiter
// ---------------------------------------------------------------------------
// Counters live in the `rateLimits` collection so limits hold across all
// serverless instances. One doc per key per window; a TTL policy on
// `expiresAt` (see firestore.indexes.json) deletes old windows.
//
// The check is a read followed by an increment rather than a transaction:
// concurrent requests at the limit can overshoot slightly, but a busy key
// never hits transaction contention.

import { NextRequest } from "next/server";
import crypto from "crypto";
import admin, { adminDb } from "@/lib/firebase-admin";

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 300; // per window (default for partner API keys)
const EXPIRY_BUFFER_MS = 60 * 60 * 1000; // keep docs 1h past window end

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number = MAX_REQUESTS,
  windowMs: number = WINDOW_MS
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowIndex = Math.floor(now / windowMs);
  const windowEnd = (windowIndex + 1) * windowMs;

  // Hash the key so emails/IPs don't appear in document ids
  const keyHash = crypto.createHash("sha256").update(key).digest("hex").slice(0, 32);
  const ref = adminDb
    .collection("rateLimits")
    .doc(`${keyHash}_${windowMs}_${windowIndex}`);

  try {
    const snap = await ref.get();
    const count = (snap.data()?.count as number | undefined) ?? 0;

    if (count >= maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
      };
    }

    await ref.set(
      {
        count: admin.firestore.FieldValue.increment(1),
        expiresAt: admin.firestore.Timestamp.fromMillis(windowEnd + EXPIRY_BUFFER_MS),
      },
      { merge: true }
    );
    return { allowed: true };
  } catch (error) {
    // Fail open so a Firestore outage doesn't take the API down with it
    console.error("Rate limit check failed:", error);
    return { allowed: true };
  }
}

/** Extract client IP from Vercel's x-forwarded-for header. */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
