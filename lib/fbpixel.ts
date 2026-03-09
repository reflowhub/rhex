// Meta Pixel event helper
// Pixel is loaded in app/layout.tsx via NEXT_PUBLIC_META_PIXEL_ID

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type PixelEventParams = Record<string, string | number | boolean | undefined>;

export function fbPixelEvent(eventName: string, params?: PixelEventParams) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, params);
  }
}
