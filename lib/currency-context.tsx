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
  country: string | null;
  convertFromNZD: (priceNZD: number) => number;
  convertFromAUD: (priceAUD: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "AUD",
  setCurrency: () => {},
  fxRate: 1,
  loading: true,
  country: null,
  convertFromNZD: (price) => price,
  convertFromAUD: (price) => price,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<"AUD" | "NZD">("AUD");
  const [fxRate, setFxRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    // NZD is locked ("coming soon"), always force AUD
    const saved = localStorage.getItem("preferred-currency");
    if (saved === "NZD") {
      localStorage.setItem("preferred-currency", "AUD");
    }

    // Fetch FX rate (also returns geo country)
    async function fetchRate() {
      try {
        const res = await fetch("/api/fx");
        if (res.ok) {
          const data = await res.json();
          setFxRate(data.NZD_AUD || 1);
          if (data.country) setCountry(data.country);
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
      return Math.floor(converted / 5) * 5;
    },
    [currency, fxRate]
  );

  const convertFromAUD = useCallback(
    (priceAUD: number) => {
      if (currency === "AUD") return priceAUD;
      // AUD → NZD: divide by the NZD_AUD rate
      const converted = fxRate > 0 ? priceAUD / fxRate : priceAUD;
      return Math.floor(converted / 5) * 5;
    },
    [currency, fxRate]
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, fxRate, loading, country, convertFromNZD, convertFromAUD }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
