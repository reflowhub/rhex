/**
 * Commission calculation for Mode A referral partners.
 *
 * Supports three models:
 * - "percentage" — commission = quoteTotal * (rate / 100)
 * - "flat"       — commission = flatFee * deviceCount
 * - "tiered"     — find the applicable tier by monthly volume, use its rate as percentage
 */

export interface PartnerCommissionConfig {
  commissionModel: string; // "percentage" | "flat" | "tiered"
  commissionPercent?: number; // default 5
  commissionFlat?: number; // $ per device
  commissionTiers?: { minQty: number; rate: number }[]; // sorted ascending by minQty
}

/**
 * Calculate commission for a Mode A referral.
 *
 * @param quoteTotal — The public payout amount in NZD
 * @param deviceCount — Number of devices in the quote
 * @param config — Partner's commission configuration
 * @param monthlyDeviceCount — Total devices attributed this month (for tiered model)
 * @returns Commission amount in NZD, rounded to 2dp
 */
export function calculateCommission(
  quoteTotal: number,
  deviceCount: number,
  config: PartnerCommissionConfig,
  monthlyDeviceCount: number = 0
): number {
  let amount = 0;

  switch (config.commissionModel) {
    case "flat": {
      const flatFee = config.commissionFlat ?? 5;
      amount = flatFee * deviceCount;
      break;
    }

    case "tiered": {
      const tiers = config.commissionTiers ?? [];
      // Find the highest tier where monthlyDeviceCount >= minQty
      let applicableRate = config.commissionPercent ?? 5; // fallback
      for (const tier of tiers) {
        if (monthlyDeviceCount >= tier.minQty) {
          applicableRate = tier.rate;
        }
      }
      amount = quoteTotal * (applicableRate / 100);
      break;
    }

    case "percentage":
    default: {
      const rate = config.commissionPercent ?? 5;
      amount = quoteTotal * (rate / 100);
      break;
    }
  }

  return Math.round(amount * 100) / 100;
}
