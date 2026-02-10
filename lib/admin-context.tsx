"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminData {
  email: string;
}

interface AdminContextValue {
  admin: AdminData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AdminContext = createContext<AdminContextValue>({
  admin: null,
  loading: true,
  logout: async () => {},
});

export function useAdmin() {
  return useContext(AdminContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data: AdminData) => setAdmin(data))
      .catch(() => {
        router.push("/admin/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = async () => {
    await fetch("/api/admin/auth/session", { method: "DELETE" });
    setAdmin(null);
    router.push("/admin/login");
  };

  return (
    <AdminContext.Provider value={{ admin, loading, logout }}>
      {children}
    </AdminContext.Provider>
  );
}
