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
