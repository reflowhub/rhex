"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Globe,
  Users,
  MapPin,
  Clock,
  MousePointerClick,
  Eye,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const ACTIVE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

const CHART_COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(35, 90%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(270, 50%, 55%)",
  "hsl(190, 70%, 45%)",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface TrafficData {
  summary: {
    totalVisitors: number;
    avgDuration: number;
    bounceRate: number;
    totalPageViews: number;
  };
  daily: {
    date: string;
    visitors: number;
    pageViews: number;
    avgDuration: number;
    bounceRate: number;
  }[];
  sources: { source: string; count: number; percentage: number }[];
  topPages: { page: string; views: number; uniqueVisitors: number }[];
  countries: {
    country: string;
    countryCode: string;
    visitors: number;
  }[];
}

type VisitorTab = "live" | "traffic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function formatLastSeen(lastSeen: Date): string {
  const seconds = Math.floor((Date.now() - lastSeen.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
}

function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

function toISODate(date: Date) {
  return date.toISOString().split("T")[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VisitorsPage() {
  const [activeTab, setActiveTab] = useState<VisitorTab>("live");

  // Live state
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);

  // Traffic state
  const [from, setFrom] = useState(toISODate(daysAgo(30)));
  const [to, setTo] = useState(toISODate(new Date()));
  const [activePreset, setActivePreset] = useState("30d");
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);

  // Live: Firestore real-time listener
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
      setLiveLoading(false);
    });

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

  // Traffic: fetch analytics data
  const fetchTraffic = useCallback(() => {
    setTrafficLoading(true);
    fetch(`/api/admin/analytics/traffic?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setTrafficData)
      .catch(console.error)
      .finally(() => setTrafficLoading(false));
  }, [from, to]);

  useEffect(() => {
    if (activeTab === "traffic") fetchTraffic();
  }, [activeTab, fetchTraffic]);

  function applyPreset(preset: string) {
    setActivePreset(preset);
    const today = toISODate(new Date());
    setTo(today);
    if (preset === "7d") setFrom(toISODate(daysAgo(7)));
    else if (preset === "30d") setFrom(toISODate(daysAgo(30)));
    else if (preset === "90d") setFrom(toISODate(daysAgo(90)));
  }

  // Live tab derived data
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visitors</h1>
          <p className="mt-1 text-muted-foreground">
            {activeTab === "live"
              ? "Real-time view of active visitors on the site"
              : "Traffic analytics, sources, and session metrics"}
          </p>
        </div>

        {activeTab === "traffic" && (
          <div className="flex flex-wrap items-center gap-2">
            {["7d", "30d", "90d"].map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  activePreset === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {p}
              </button>
            ))}
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset("");
              }}
              className="h-8 w-[130px] min-w-0 text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset("");
              }}
              className="h-8 w-[130px] min-w-0 text-xs"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { key: "live", label: "Live" },
            { key: "traffic", label: "Traffic" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.key === "live" && !liveLoading && (
              <span className="ml-2 inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                {visitors.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* Live Tab                                                          */}
      {/* ================================================================= */}
      {activeTab === "live" && (
        <>
          {liveLoading ? (
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
                <h2 className="text-lg font-semibold mb-4">
                  Visitor Locations
                </h2>
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
                      <circle
                        r={4}
                        fill="hsl(220, 70%, 55%)"
                        opacity={0.85}
                      />
                      <circle
                        r={8}
                        fill="hsl(220, 70%, 55%)"
                        opacity={0.25}
                      />
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
                                {formatLastSeen(v.lastSeen)}
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
        </>
      )}

      {/* ================================================================= */}
      {/* Traffic Tab                                                       */}
      {/* ================================================================= */}
      {activeTab === "traffic" && (
        <>
          {trafficLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !trafficData ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No traffic data available for this period
            </p>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Total Visitors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">
                      {trafficData.summary.totalVisitors.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Avg Duration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">
                      {formatDurationSeconds(trafficData.summary.avgDuration)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4" />
                      Bounce Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">
                      {trafficData.summary.bounceRate}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Page Views
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold">
                      {trafficData.summary.totalPageViews.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Visitors Over Time */}
              {trafficData.daily.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="text-lg font-semibold mb-4">
                    Visitors Over Time
                  </h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trafficData.daily}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                        allowDecimals={false}
                      />
                      <Tooltip
                        labelFormatter={(label) =>
                          formatDate(String(label))
                        }
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="visitors"
                        name="Visitors"
                        stroke={CHART_COLORS[0]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pageViews"
                        name="Page Views"
                        stroke={CHART_COLORS[1]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Sources + Top Pages side by side */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Traffic Sources */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="text-lg font-semibold mb-4">
                    Traffic Sources
                  </h2>
                  {trafficData.sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No source data
                    </p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={trafficData.sources.slice(0, 6)}
                            dataKey="count"
                            nameKey="source"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({
                              source,
                              percentage,
                            }: // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            any) =>
                              `${source} (${percentage}%)`
                            }
                            labelLine={false}
                          >
                            {trafficData.sources
                              .slice(0, 6)
                              .map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                                />
                              ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-xs text-muted-foreground">
                              <th className="pb-2 font-medium">Source</th>
                              <th className="pb-2 font-medium text-right">
                                Visitors
                              </th>
                              <th className="pb-2 font-medium text-right">
                                %
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {trafficData.sources.map((s) => (
                              <tr
                                key={s.source}
                                className="border-b border-border/50"
                              >
                                <td className="py-1.5 font-mono text-xs">
                                  {s.source}
                                </td>
                                <td className="py-1.5 text-right">
                                  {s.count}
                                </td>
                                <td className="py-1.5 text-right text-muted-foreground">
                                  {s.percentage}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Top Entry Pages */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="text-lg font-semibold mb-4">
                    Top Entry Pages
                  </h2>
                  {trafficData.topPages.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No page data
                    </p>
                  ) : (
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(
                        200,
                        trafficData.topPages.length * 36
                      )}
                    >
                      <BarChart
                        data={trafficData.topPages}
                        layout="vertical"
                        margin={{ left: 80 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="page"
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                          width={80}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="uniqueVisitors"
                          name="Unique Visitors"
                          fill={CHART_COLORS[0]}
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Visitors by Country */}
              {trafficData.countries.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="text-lg font-semibold mb-4">
                    Visitors by Country
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="pb-2 font-medium">Country</th>
                          <th className="pb-2 font-medium text-right">
                            Visitors
                          </th>
                          <th className="pb-2 font-medium text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trafficData.countries.map((c) => (
                          <tr
                            key={c.countryCode}
                            className="border-b border-border/50"
                          >
                            <td className="py-1.5">
                              {c.countryCode && c.countryCode !== "??" && (
                                <span className="mr-1.5">
                                  {countryCodeToFlag(c.countryCode)}
                                </span>
                              )}
                              {c.country}
                            </td>
                            <td className="py-1.5 text-right">{c.visitors}</td>
                            <td className="py-1.5 text-right text-muted-foreground">
                              {trafficData.summary.totalVisitors > 0
                                ? (
                                    (c.visitors /
                                      trafficData.summary.totalVisitors) *
                                    100
                                  ).toFixed(1)
                                : 0}
                              %
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
