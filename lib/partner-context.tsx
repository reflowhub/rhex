"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PartnerData {
  id: string;
  name: string;
  code: string;
  contactEmail: string;
  modes: string[];
  status: string;
  authUid: string;
  commissionModel: string | null;
  commissionPercent: number | null;
  commissionFlat: number | null;
  commissionTiers: unknown | null;
  payoutFrequency: string | null;
  partnerRateDiscount: number | null;
}

interface PartnerContextValue {
  partner: PartnerData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PartnerContext = createContext<PartnerContextValue>({
  partner: null,
  loading: true,
  logout: async () => {},
});

export function usePartner() {
  return useContext(PartnerContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PartnerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/partner/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data: PartnerData) => setPartner(data))
      .catch(() => {
        router.push("/partner/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = async () => {
    await fetch("/api/partner/auth/session", { method: "DELETE" });
    setPartner(null);
    router.push("/partner/login");
  };

  return (
    <PartnerContext.Provider value={{ partner, loading, logout }}>
      {children}
    </PartnerContext.Provider>
  );
}
