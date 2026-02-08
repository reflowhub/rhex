import { adminDb } from "@/lib/firebase-admin";

export interface FXRates {
  NZD_AUD: number;
  AUD_NZD: number;
  date: string;
  source: string;
}

/**
 * Get today's FX rate, fetching from API and caching in Firestore if not yet cached.
 * Falls back to most recent cached rate if API fails.
 */
export async function getTodayFXRate(): Promise<FXRates> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Check Firestore cache
  const cacheDoc = await adminDb.collection("exchangeRates").doc(today).get();
  if (cacheDoc.exists) {
    return cacheDoc.data() as FXRates;
  }

  // Cache miss — fetch from API
  const apiKey = process.env.FX_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/pair/NZD/AUD`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.result === "success" && data.conversion_rate) {
          const rates: FXRates = {
            NZD_AUD: data.conversion_rate,
            AUD_NZD: 1 / data.conversion_rate,
            date: today,
            source: "exchangerate-api.com",
          };

          // Cache in Firestore
          await adminDb.collection("exchangeRates").doc(today).set(rates);
          return rates;
        }
      }
    } catch (error) {
      console.error("FX API call failed:", error);
    }
  }

  // Fallback: most recent cached rate
  const fallback = await adminDb
    .collection("exchangeRates")
    .orderBy("date", "desc")
    .limit(1)
    .get();

  if (!fallback.empty) {
    return fallback.docs[0].data() as FXRates;
  }

  // No cached rates at all — use a reasonable default
  console.warn("No FX rates available, using default NZD_AUD=0.92");
  return {
    NZD_AUD: 0.92,
    AUD_NZD: 1.087,
    date: today,
    source: "default",
  };
}

/**
 * Convert NZD price to display currency with optional rounding.
 */
export function convertPrice(
  priceNZD: number,
  currency: "AUD" | "NZD",
  fxRate: number,
  roundTo: number = 5
): number {
  if (currency === "NZD") return priceNZD;
  const converted = priceNZD * fxRate;
  if (roundTo <= 0) return Math.round(converted * 100) / 100;
  return Math.round(converted / roundTo) * roundTo;
}
