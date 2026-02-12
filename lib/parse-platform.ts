/**
 * Parse a User-Agent string into a human-readable platform name.
 * Returns e.g. "iOS", "Android", "macOS", "Windows", "Linux", or "Unknown".
 */
export function parsePlatform(ua: string): string {
  // Order matters — check mobile platforms first since they may also contain desktop tokens
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  return "Unknown";
}
