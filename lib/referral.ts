// ---------------------------------------------------------------------------
// Client-side referral tracking utilities
// Stores referral code in localStorage + cookie for 30-day attribution window
// ---------------------------------------------------------------------------

const STORAGE_KEY = "rhex_referral";
const COOKIE_NAME = "rhex_ref";
const EXPIRY_DAYS = 30;

interface StoredReferral {
  code: string;
  timestamp: number;
}

/**
 * Capture a referral code from a URL parameter.
 * Stores in localStorage (with timestamp) and sets a 30-day cookie.
 */
export function captureReferral(code: string): void {
  if (!code || typeof window === "undefined") return;

  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 3) return;

  const referral: StoredReferral = {
    code: normalized,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(referral));
  } catch {
    // localStorage not available — cookie will suffice
  }

  // Set cookie (30-day max-age)
  document.cookie = `${COOKIE_NAME}=${normalized}; path=/; max-age=${EXPIRY_DAYS * 24 * 60 * 60}; SameSite=Lax`;
}

/**
 * Get the current referral code if still within the 30-day attribution window.
 * Returns null if expired or not set.
 */
export function getReferralCode(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const referral: StoredReferral = JSON.parse(stored);
      const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - referral.timestamp < expiryMs) {
        return referral.code;
      }
      // Expired — clean up
      clearReferral();
      return null;
    }
  } catch {
    // Fall through to cookie check
  }

  // Fallback: check cookie
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`)
  );
  return match?.[1] ?? null;
}

/**
 * Clear stored referral data (localStorage + cookie).
 */
export function clearReferral(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }

  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
