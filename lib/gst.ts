/**
 * Calculate GST amount from a GST-inclusive price.
 * Australian GST is 10%, so GST = price / 11.
 */
export function calculateGST(gstInclusivePrice: number): number {
  return Math.round((gstInclusivePrice / 11) * 100) / 100;
}
