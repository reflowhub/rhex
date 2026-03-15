"use client";

import { useState, useEffect, useCallback } from "react";

export type DisplayCurrency = "AUD" | "NZD" | "USD";

interface UseFXReturn {
  rates: { NZD_AUD: number; NZD_USD: number };
  loading: boolean;
  convert: (amountNZD: number, currency: DisplayCurrency) => number;
  formatPrice: (
    amountNZD: number | null | undefined,
    currency: DisplayCurrency
  ) => string;
  /** @deprecated use rates.NZD_AUD instead */
  fxRate: number;
}

export function useFX(): UseFXReturn {
  const [rates, setRates] = useState({ NZD_AUD: 0.92, NZD_USD: 0.57 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/fx")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.NZD_AUD) {
          setRates({
            NZD_AUD: data.NZD_AUD,
            NZD_USD: data.NZD_USD || 0.57,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const convert = useCallback(
    (amountNZD: number, currency: DisplayCurrency) => {
      if (currency === "NZD") return amountNZD;
      const rate = currency === "AUD" ? rates.NZD_AUD : rates.NZD_USD;
      const converted = amountNZD * rate;
      return Math.floor(converted / 5) * 5;
    },
    [rates]
  );

  const formatPrice = useCallback(
    (amountNZD: number | null | undefined, currency: DisplayCurrency) => {
      if (amountNZD == null) return "\u2014";
      const displayAmount = convert(amountNZD, currency);
      const locale =
        currency === "AUD" ? "en-AU" : currency === "USD" ? "en-US" : "en-NZ";
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).format(displayAmount);
    },
    [convert]
  );

  return { rates, loading, convert, formatPrice, fxRate: rates.NZD_AUD };
}
