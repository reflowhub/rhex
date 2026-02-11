import { adminDb } from "@/lib/firebase-admin";

export interface PricingSettings {
  gradeRatios: Record<string, number>;
  rounding: 5 | 10;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  gradeRatios: { B: 70, C: 40, D: 20, E: 10 },
  rounding: 5,
};

/**
 * Load pricing settings for a specific category.
 *
 * The `settings/pricing` document supports two formats:
 * - **New (category-keyed)**: `{ Phone: { gradeRatios: {...}, rounding: 5 }, Watch: {...} }`
 * - **Legacy (flat)**: `{ gradeRatios: {...}, rounding: 5 }` — treated as Phone settings
 *
 * If no category is provided, defaults to "Phone".
 */
export async function loadPricingSettings(
  category?: string
): Promise<PricingSettings> {
  const cat = category ?? "Phone";
  const doc = await adminDb.doc("settings/pricing").get();
  if (!doc.exists) return DEFAULT_PRICING_SETTINGS;

  const data = doc.data()!;

  // New format: category-keyed
  if (data[cat] && typeof data[cat] === "object") {
    const catData = data[cat] as Record<string, unknown>;
    return {
      gradeRatios:
        (catData.gradeRatios as Record<string, number>) ??
        DEFAULT_PRICING_SETTINGS.gradeRatios,
      rounding: catData.rounding === 10 ? 10 : 5,
    };
  }

  // Legacy format: flat gradeRatios at top level — treat as Phone
  if (cat === "Phone" && data.gradeRatios) {
    return {
      gradeRatios: data.gradeRatios ?? DEFAULT_PRICING_SETTINGS.gradeRatios,
      rounding: data.rounding === 10 ? 10 : 5,
    };
  }

  return DEFAULT_PRICING_SETTINGS;
}

export function roundPrice(price: number, rounding: 5 | 10): number {
  return Math.max(0, Math.round(price / rounding) * rounding);
}
