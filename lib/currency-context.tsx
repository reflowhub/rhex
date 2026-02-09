"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface CurrencyContextType {
  currency: "AUD" | "NZD";
  setCurrency: (currency: "AUD" | "NZD") => void;
  fxRate: number;
  loading: boolean;
  convertFromNZD: (priceNZD: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "NZD",
  setCurrency: () => {},
  fxRate: 1,
  loading: true,
  convertFromNZD: (price) => price,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<"AUD" | "NZD">("NZD");
  const [fxRate, setFxRate] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("preferred-currency");
    const hasExplicitChoice = saved === "AUD" || saved === "NZD";
    if (hasExplicitChoice) {
      setCurrencyState(saved);
    }

    // Fetch FX rate (also returns geo country for auto-detection)
    async function fetchRate() {
      try {
        const res = await fetch("/api/fx");
        if (res.ok) {
          const data = await res.json();
          setFxRate(data.NZD_AUD || 1);

          // Auto-detect currency from geo if user hasn't explicitly chosen
          if (!hasExplicitChoice && data.country === "AU") {
            setCurrencyState("AUD");
          }
        }
      } catch {
        console.error("Failed to fetch FX rate");
      } finally {
        setLoading(false);
      }
    }
    fetchRate();
  }, []);

  const setCurrency = useCallback((c: "AUD" | "NZD") => {
    setCurrencyState(c);
    localStorage.setItem("preferred-currency", c);
  }, []);

  const convertFromNZD = useCallback(
    (priceNZD: number) => {
      if (currency === "NZD") return priceNZD;
      const converted = priceNZD * fxRate;
      return Math.round(converted / 5) * 5;
    },
    [currency, fxRate]
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, fxRate, loading, convertFromNZD }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
