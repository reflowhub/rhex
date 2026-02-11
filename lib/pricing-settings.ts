import { adminDb } from "@/lib/firebase-admin";

export interface PricingSettings {
  gradeRatios: { B: number; C: number; D: number; E: number };
  rounding: 5 | 10;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  gradeRatios: { B: 70, C: 40, D: 20, E: 10 },
  rounding: 5,
};

export async function loadPricingSettings(): Promise<PricingSettings> {
  const doc = await adminDb.doc("settings/pricing").get();
  if (!doc.exists) return DEFAULT_PRICING_SETTINGS;
  const data = doc.data()!;
  return {
    gradeRatios: data.gradeRatios ?? DEFAULT_PRICING_SETTINGS.gradeRatios,
    rounding: data.rounding === 10 ? 10 : 5,
  };
}

export function roundPrice(price: number, rounding: 5 | 10): number {
  return Math.max(0, Math.round(price / rounding) * rounding);
}
