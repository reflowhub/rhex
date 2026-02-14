"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Globe, Users, MapPin } from "lucide-react";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const ACTIVE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

interface Visitor {
  sessionId: string;
  lat?: number;
  lng?: number;
  city?: string;
  country?: string;
  countryCode?: string;
  page: string;
  lastSeen: Date;
}

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function formatDuration(lastSeen: Date): string {
  const seconds = Math.floor((Date.now() - lastSeen.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
}

export default function LiveVisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cutoff = Timestamp.fromDate(
      new Date(Date.now() - ACTIVE_THRESHOLD)
    );
    const q = query(
      collection(db, "visitors"),
      where("lastSeen", ">", cutoff)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const active: Visitor[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const lastSeen = data.lastSeen?.toDate?.() ?? new Date(0);
        if (now - lastSeen.getTime() < ACTIVE_THRESHOLD) {
          active.push({
            sessionId: doc.id,
            lat: data.lat,
            lng: data.lng,
            city: data.city,
            country: data.country,
            countryCode: data.countryCode,
            page: data.page,
            lastSeen,
          });
        }
      });
      setVisitors(active);
      setLoading(false);
    });

    // Re-filter stale entries every 30s
    const refreshInterval = setInterval(() => {
      setVisitors((prev) => {
        const now = Date.now();
        return prev.filter(
          (v) => now - v.lastSeen.getTime() < ACTIVE_THRESHOLD
        );
      });
    }, 30_000);

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const mappableVisitors = visitors.filter(
    (v) => v.lat != null && v.lng != null
  );

  const countryBreakdown = visitors.reduce<Record<string, number>>(
    (acc, v) => {
      const key = v.country || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  const pageCounts = visitors.reduce<Record<string, number>>((acc, v) => {
    acc[v.page] = (acc[v.page] || 0) + 1;
    return acc;
  }, {});
  const sortedPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Live Visitors</h1>
        <p className="mt-1 text-muted-foreground">
          Real-time view of active visitors on the site
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Visitors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{visitors.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  in the last 2 minutes
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Countries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">
                  {Object.keys(countryBreakdown).length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Object.entries(countryBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([c, n]) => `${c} (${n})`)
                    .join(", ")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Top Pages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {sortedPages.slice(0, 3).map(([page, count]) => (
                    <p key={page} className="text-sm">
                      <span className="font-medium">{count}</span>
                      <span className="ml-2 text-muted-foreground">
                        {page}
                      </span>
                    </p>
                  ))}
                  {sortedPages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No active pages
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* World Map */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Visitor Locations</h2>
            <ComposableMap
              projectionConfig={{ scale: 147 }}
              className="w-full"
              style={{ maxHeight: 420 }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="hsl(var(--muted))"
                      stroke="hsl(var(--border))"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: {
                          outline: "none",
                          fill: "hsl(var(--muted-foreground) / 0.2)",
                        },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>
              {mappableVisitors.map((v) => (
                <Marker
                  key={v.sessionId}
                  coordinates={[v.lng!, v.lat!]}
                >
                  <circle r={4} fill="hsl(220, 70%, 55%)" opacity={0.85} />
                  <circle r={8} fill="hsl(220, 70%, 55%)" opacity={0.25} />
                </Marker>
              ))}
            </ComposableMap>
            {mappableVisitors.length === 0 && visitors.length > 0 && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                Location data unavailable for current visitors
              </p>
            )}
          </div>

          {/* Active Sessions Table */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Active Sessions</h2>
            {visitors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No active visitors right now
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Country</th>
                      <th className="pb-2 font-medium">City</th>
                      <th className="pb-2 font-medium">Page</th>
                      <th className="pb-2 font-medium">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors
                      .sort(
                        (a, b) =>
                          b.lastSeen.getTime() - a.lastSeen.getTime()
                      )
                      .map((v) => (
                        <tr
                          key={v.sessionId}
                          className="border-b border-border/50"
                        >
                          <td className="py-2">
                            {v.countryCode && (
                              <span className="mr-1.5">
                                {countryCodeToFlag(v.countryCode)}
                              </span>
                            )}
                            {v.country || "Unknown"}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {v.city || "\u2014"}
                          </td>
                          <td className="py-2 font-mono text-xs">
                            {v.page}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {formatDuration(v.lastSeen)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
