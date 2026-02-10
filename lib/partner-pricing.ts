/**
 * Calculate the partner rate for a Mode B partner.
 * Partner rate = public payout * (1 - discount/100)
 *
 * @param publicPriceNZD — The public consumer payout in NZD
 * @param partnerRateDiscount — Percentage below public price (e.g. 5 = 5% less)
 * @returns Partner rate in NZD, rounded to 2 decimal places
 */
export function calculatePartnerRate(
  publicPriceNZD: number,
  partnerRateDiscount: number
): number {
  const rate = publicPriceNZD * (1 - partnerRateDiscount / 100);
  return Math.round(rate * 100) / 100;
}
