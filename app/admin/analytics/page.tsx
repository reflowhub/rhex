"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FunnelStage {
  status: string;
  count: number;
}
interface FunnelData {
  stages: FunnelStage[];
  cancelled: number;
  total: number;
}

interface GradeDistEntry {
  grade: string;
  count: number;
  totalNZD: number;
  avgNZD: number;
}
interface CurrencySplitEntry {
  currency: string;
  count: number;
}
interface DailyVolume {
  date: string;
  count: number;
  totalNZD: number;
}
interface RevenueData {
  quoteCount: number;
  paidCount: number;
  paidValueNZD: number;
  paidValueAUD: number;
  averageValueNZD: number;
  averageValueAUD: number;
  fxRate: number;
  gradeDistribution: GradeDistEntry[];
  currencySplit: CurrencySplitEntry[];
  gradeRevisions: {
    total: number;
    revised: number;
    upgrades: number;
    downgrades: number;
    avgRevisionDeltaNZD: number;
  };
  dailyVolume: DailyVolume[];
}

interface TopPartnerEntry {
  partnerId: string;
  partnerName: string;
  mode: string;
  count: number;
  totalNZD: number;
}
interface PartnerData {
  directVsPartner: { type: string; count: number; totalNZD: number }[];
  modeSplit: { mode: string; count: number; totalNZD: number }[];
  topPartnersByCount: TopPartnerEntry[];
  topPartnersByValue: TopPartnerEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(35, 90%, 55%)",
  "hsl(350, 65%, 55%)",
  "hsl(270, 50%, 55%)",
  "hsl(190, 70%, 45%)",
];

const STATUS_LABELS: Record<string, string> = {
  quoted: "Quoted",
  accepted: "Accepted",
  shipped: "Shipped",
  received: "Received",
  inspected: "Inspected",
  paid: "Paid",
};

function formatCurrency(value: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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

export default function AnalyticsPage() {
  const [from, setFrom] = useState(toISODate(daysAgo(30)));
  const [to, setTo] = useState(toISODate(new Date()));
  const [activePreset, setActivePreset] = useState<string>("30d");

  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null);

  const [funnelLoading, setFunnelLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [partnerLoading, setPartnerLoading] = useState(true);

  const fetchAll = useCallback(() => {
    const params = `from=${from}&to=${to}`;

    setFunnelLoading(true);
    setRevenueLoading(true);
    setPartnerLoading(true);

    fetch(`/api/admin/analytics/funnel?${params}`)
      .then((r) => r.json())
      .then(setFunnelData)
      .catch(console.error)
      .finally(() => setFunnelLoading(false));

    fetch(`/api/admin/analytics/revenue?${params}`)
      .then((r) => r.json())
      .then(setRevenueData)
      .catch(console.error)
      .finally(() => setRevenueLoading(false));

    fetch(`/api/admin/analytics/partners?${params}`)
      .then((r) => r.json())
      .then(setPartnerData)
      .catch(console.error)
      .finally(() => setPartnerLoading(false));
  }, [from, to]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function applyPreset(preset: string) {
    setActivePreset(preset);
    const today = toISODate(new Date());
    setTo(today);
    if (preset === "7d") setFrom(toISODate(daysAgo(7)));
    else if (preset === "30d") setFrom(toISODate(daysAgo(30)));
    else if (preset === "90d") setFrom(toISODate(daysAgo(90)));
  }

  // KPI calculations
  const conversionRate =
    funnelData && funnelData.stages[0]?.count > 0
      ? (
          ((funnelData.stages.at(-1)?.count ?? 0) /
            funnelData.stages[0].count) *
          100
        ).toFixed(1)
      : "0";

  return (
    <div className="space-y-8">
      {/* Header + Date Range */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Quote conversion, revenue, and partner performance
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            className="h-8 w-[130px] text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setActivePreset("");
            }}
            className="h-8 w-[130px] text-xs"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Quotes"
          value={funnelData?.total?.toString() ?? "—"}
          subtitle={
            funnelData ? `${funnelData.cancelled} cancelled` : undefined
          }
          loading={funnelLoading}
        />
        <KPICard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          subtitle="Quoted to Paid"
          loading={funnelLoading}
        />
        <KPICard
          title="Paid Revenue"
          value={
            revenueData
              ? formatCurrency(revenueData.paidValueAUD)
              : "—"
          }
          subtitle={
            revenueData
              ? `${formatCurrency(revenueData.paidValueNZD, "NZD")} NZD`
              : undefined
          }
          loading={revenueLoading}
        />
        <KPICard
          title="Avg Order Value"
          value={
            revenueData
              ? formatCurrency(revenueData.averageValueAUD)
              : "—"
          }
          subtitle={
            revenueData
              ? `${revenueData.paidCount} paid quotes`
              : undefined
          }
          loading={revenueLoading}
        />
      </div>

      {/* Section 1: Conversion Funnel */}
      <Section title="Conversion Funnel" loading={funnelLoading}>
        {funnelData && <FunnelChart data={funnelData} />}
      </Section>

      {/* Section 2: Revenue & Pricing */}
      <Section title="Revenue & Pricing" loading={revenueLoading}>
        {revenueData && <RevenueSection data={revenueData} />}
      </Section>

      {/* Section 3: Partner Performance */}
      <Section title="Partner Performance" loading={partnerLoading}>
        {partnerData && <PartnerSection data={partnerData} />}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({
  title,
  value,
  subtitle,
  loading,
}: {
  title: string;
  value: string;
  subtitle?: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

function FunnelChart({ data }: { data: FunnelData }) {
  const chartData = data.stages.map((stage, i) => {
    const prev = i > 0 ? data.stages[i - 1].count : stage.count;
    const dropOff = prev > 0 ? ((prev - stage.count) / prev) * 100 : 0;
    return {
      ...stage,
      label: STATUS_LABELS[stage.status] ?? stage.status,
      dropOff: i === 0 ? null : `-${dropOff.toFixed(1)}%`,
    };
  });

  if (data.total === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No quotes in this date range
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <XAxis type="number" />
          <YAxis
            type="category"
            dataKey="label"
            width={85}
            tick={{ fontSize: 13 }}
          />
          <Tooltip
            formatter={(value) => [value ?? 0, "Quotes"]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: 13,
            }}
          />
          <Bar
            dataKey="count"
            fill="hsl(220, 70%, 55%)"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Drop-off table */}
      <div className="grid grid-cols-6 gap-2 text-center text-sm">
        {chartData.map((stage) => (
          <div key={stage.status}>
            <p className="font-medium">{stage.count}</p>
            <p className="text-xs text-muted-foreground">{stage.label}</p>
            {stage.dropOff && (
              <p className="text-xs text-red-500">{stage.dropOff}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

function RevenueSection({ data }: { data: RevenueData }) {
  if (data.quoteCount === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No quotes in this date range
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Grade distribution + Currency split side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Grade Distribution */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Grade Distribution
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.gradeDistribution}>
              <XAxis dataKey="grade" />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [
                  name === "count" ? (value ?? 0) : formatCurrency((value as number) ?? 0, "NZD"),
                  name === "count" ? "Quotes" : "Avg NZD",
                ]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: 13,
                }}
              />
              <Bar
                dataKey="count"
                fill="hsl(220, 70%, 55%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Currency Split */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Display Currency Split
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.currencySplit}
                dataKey="count"
                nameKey="currency"
                cx="50%"
                cy="50%"
                outerRadius={75}
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {data.currencySplit.map((_, i) => (
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
                  borderRadius: "6px",
                  fontSize: 13,
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grade Revisions */}
      {data.gradeRevisions.total > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Inspection Grade Revisions
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-2xl font-bold">{data.gradeRevisions.total}</p>
              <p className="text-xs text-muted-foreground">Inspected</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.gradeRevisions.revised}</p>
              <p className="text-xs text-muted-foreground">Grade changed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {data.gradeRevisions.upgrades}
              </p>
              <p className="text-xs text-muted-foreground">Upgrades</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">
                {data.gradeRevisions.downgrades}
              </p>
              <p className="text-xs text-muted-foreground">Downgrades</p>
            </div>
          </div>
          {data.gradeRevisions.revised > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Average price revision:{" "}
              {formatCurrency(data.gradeRevisions.avgRevisionDeltaNZD, "NZD")}{" "}
              NZD per revised quote
            </p>
          )}
        </div>
      )}

      {/* Daily Volume Trend */}
      {data.dailyVolume.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Daily Quote Volume
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.dailyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(label) => formatDate(label as string)}
                formatter={(value) => [value ?? 0, "Quotes"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: 13,
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="hsl(220, 70%, 55%)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

function PartnerSection({ data }: { data: PartnerData }) {
  const totalQuotes = data.directVsPartner.reduce((s, d) => s + d.count, 0);

  if (totalQuotes === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No quotes in this date range
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Direct vs Partner + Mode Split */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Direct vs Partner-Attributed
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.directVsPartner}>
              <XAxis
                dataKey="type"
                tickFormatter={(v) =>
                  v === "direct" ? "Direct" : "Partner"
                }
              />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [
                  name === "count"
                    ? (value ?? 0)
                    : formatCurrency((value as number) ?? 0, "NZD"),
                  name === "count" ? "Quotes" : "Value (NZD)",
                ]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: 13,
                }}
              />
              <Bar
                dataKey="count"
                fill={CHART_COLORS[0]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {data.modeSplit.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Partner Mode Split
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.modeSplit}
                  dataKey="count"
                  nameKey="mode"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {data.modeSplit.map((_, i) => (
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
                    borderRadius: "6px",
                    fontSize: 13,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Partners */}
      {data.topPartnersByCount.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Top Partners by Quote Count
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(200, data.topPartnersByCount.length * 36)}>
              <BarChart
                data={data.topPartnersByCount}
                layout="vertical"
                margin={{ left: 10 }}
              >
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="partnerName"
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [value ?? 0, "Quotes"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: 13,
                  }}
                />
                <Bar
                  dataKey="count"
                  fill={CHART_COLORS[0]}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Top Partners by Value (NZD)
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(200, data.topPartnersByValue.length * 36)}>
              <BarChart
                data={data.topPartnersByValue}
                layout="vertical"
                margin={{ left: 10 }}
              >
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="partnerName"
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency((value as number) ?? 0, "NZD"),
                    "Value",
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: 13,
                  }}
                />
                <Bar
                  dataKey="totalNZD"
                  fill={CHART_COLORS[1]}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
