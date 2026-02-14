"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("visitor_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("visitor_session_id", id);
  }
  return id;
}

export function VisitorTracker() {
  const pathname = usePathname();
  const sessionIdRef = useRef("");

  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  useEffect(() => {
    if (!sessionIdRef.current) return;

    const sendHeartbeat = () => {
      fetch("/api/visitors/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          page: pathname,
        }),
      }).catch(() => {});
    };

    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    const handleUnload = () => {
      const data = JSON.stringify({
        sessionId: sessionIdRef.current,
        page: pathname,
      });
      navigator.sendBeacon(
        "/api/visitors/heartbeat",
        new Blob([data], { type: "application/json" })
      );
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [pathname]);

  return null;
}
