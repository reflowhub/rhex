"use client";

import { useState, useEffect, useCallback } from "react";

interface UseFXReturn {
  fxRate: number;
  loading: boolean;
  convert: (amountNZD: number, currency: "AUD" | "NZD") => number;
  formatPrice: (
    amountNZD: number | null | undefined,
    currency: "AUD" | "NZD"
  ) => string;
}

export function useFX(): UseFXReturn {
  const [fxRate, setFxRate] = useState(0.92); // sensible default
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/fx")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.NZD_AUD) setFxRate(data.NZD_AUD);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const convert = useCallback(
    (amountNZD: number, currency: "AUD" | "NZD") => {
      if (currency === "NZD") return amountNZD;
      const converted = amountNZD * fxRate;
      return Math.floor(converted / 5) * 5;
    },
    [fxRate]
  );

  const formatPrice = useCallback(
    (amountNZD: number | null | undefined, currency: "AUD" | "NZD") => {
      if (amountNZD == null) return "\u2014";
      const displayAmount = convert(amountNZD, currency);
      return new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-NZ", {
        style: "currency",
        currency,
      }).format(displayAmount);
    },
    [convert]
  );

  return { fxRate, loading, convert, formatPrice };
}
