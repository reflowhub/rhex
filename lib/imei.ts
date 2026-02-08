/**
 * Validate an IMEI number (15 digits + Luhn checksum)
 */
export function isValidIMEI(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  // Luhn algorithm
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Extract the TAC (Type Allocation Code) — first 8 digits of an IMEI
 */
export function extractTAC(imei: string): string {
  return imei.substring(0, 8);
}
