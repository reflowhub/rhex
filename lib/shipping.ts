export interface ShippingConfig {
  rates: Record<string, number>;
  freeThreshold: number;
  defaultRate: number;
}

/**
 * Calculate shipping cost for a set of cart items.
 * Uses the highest per-category rate (single shipment covers all items).
 * Returns 0 if subtotal meets the free shipping threshold.
 */
export function calculateShipping(
  categories: string[],
  subtotalAUD: number,
  config: ShippingConfig
): number {
  if (categories.length === 0) return 0;

  if (config.freeThreshold > 0 && subtotalAUD >= config.freeThreshold) {
    return 0;
  }

  const maxRate = Math.max(
    ...categories.map((cat) => config.rates[cat] ?? config.defaultRate)
  );

  return maxRate;
}
