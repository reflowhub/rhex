// Google Analytics 4 event helper
// gtag is loaded in app/layout.tsx via NEXT_PUBLIC_GA_ID

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type GtagEventParams = Record<string, string | number | boolean | undefined>;

export function gtagEvent(eventName: string, params?: GtagEventParams) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

export function gtagConversion(value?: number, currency?: string) {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
  if (!adsId) return;
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "conversion", {
      send_to: conversionLabel ? `${adsId}/${conversionLabel}` : adsId,
      value,
      currency,
    });
  }
}
