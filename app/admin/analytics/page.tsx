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
  totalAUD: number;
  avgAUD: number;
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
    avgRevisionDeltaAUD: number;
  };
  dailyVolume: DailyVolume[];
}

interface TopPartnerEntry {
  partnerId: string;
  partnerName: string;
  mode: string;
  count: number;
  totalNZD: number;
  totalAUD: number;
}
interface PartnerData {
  directVsPartner: { type: string; count: number; totalNZD: number; totalAUD: number }[];
  modeSplit: { mode: string; count: number; totalNZD: number; totalAUD: number }[];
  topPartnersByCount: TopPartnerEntry[];
  topPartnersByValue: TopPartnerEntry[];
}

interface InventoryData {
  soldCount: number;
  revenueAUD: number;
  totalCostAUD: number;
  totalMargin: number;
  avgMarginPerUnit: number;
  avgDaysToSell: number;
  inStockCount: number;
  inStockValueAUD: number;
  statusDistribution: { status: string; count: number }[];
  categoryPerformance: {
    category: string;
    unitsSold: number;
    revenueAUD: number;
    costAUD: number;
    margin: number;
    avgMargin: number;
  }[];
  sourceAnalysis: {
    sourceType: string;
    unitsSold: number;
    revenueAUD: number;
    costAUD: number;
    margin: number;
  }[];
  aging: {
    avgDaysInStock: number;
    brackets: { label: string; count: number }[];
  };
}

type AnalyticsTab = "quotes" | "inventory";

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

const INV_STATUS_LABELS: Record<string, string> = {
  received: "Received",
  inspecting: "Inspecting",
  refurbishing: "Refurbishing",
  listed: "Listed",
  reserved: "Reserved",
  sold: "Sold",
  parts_only: "Parts Only",
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
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("quotes");

  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);

  const [funnelLoading, setFunnelLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [partnerLoading, setPartnerLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  const fetchQuotes = useCallback(() => {
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

  const fetchInventory = useCallback(() => {
    const params = `from=${from}&to=${to}`;
    setInventoryLoading(true);

    fetch(`/api/admin/analytics/inventory?${params}`)
      .then((r) => r.json())
      .then(setInventoryData)
      .catch(console.error)
      .finally(() => setInventoryLoading(false));
  }, [from, to]);

  useEffect(() => {
    if (activeTab === "quotes") fetchQuotes();
    else fetchInventory();
  }, [activeTab, fetchQuotes, fetchInventory]);

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
            {activeTab === "quotes"
              ? "Quote conversion, revenue, and partner performance"
              : "Inventory margin, aging, and category performance"}
          </p>
        </div>

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
            className="h-8 w-[150px] min-w-0 text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setActivePreset("");
            }}
            className="h-8 w-[150px] min-w-0 text-xs"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { key: "quotes", label: "Quotes" },
            { key: "inventory", label: "Inventory" },
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
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* Quotes Tab                                                        */}
      {/* ================================================================= */}
      {activeTab === "quotes" && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Quotes"
              value={funnelData?.total?.toString() ?? "\u2014"}
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
                  : "\u2014"
              }
              subtitle={
                revenueData && revenueData.paidCount > 0
                  ? `FX rate: ${revenueData.fxRate.toFixed(4)}`
                  : undefined
              }
              loading={revenueLoading}
            />
            <KPICard
              title="Avg Order Value"
              value={
                revenueData
                  ? formatCurrency(revenueData.averageValueAUD)
                  : "\u2014"
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
        </>
      )}

      {/* ================================================================= */}
      {/* Inventory Tab                                                     */}
      {/* ================================================================= */}
      {activeTab === "inventory" && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KPICard
              title="Units Sold"
              value={inventoryData?.soldCount?.toString() ?? "\u2014"}
              subtitle="in date range"
              loading={inventoryLoading}
            />
            <KPICard
              title="Revenue"
              value={
                inventoryData
                  ? formatCurrency(inventoryData.revenueAUD)
                  : "\u2014"
              }
              subtitle="sell price (AUD)"
              loading={inventoryLoading}
            />
            <KPICard
              title="Avg Margin"
              value={
                inventoryData
                  ? formatCurrency(inventoryData.avgMarginPerUnit)
                  : "\u2014"
              }
              subtitle={
                inventoryData && inventoryData.soldCount > 0
                  ? `${formatCurrency(inventoryData.totalMargin)} total`
                  : undefined
              }
              loading={inventoryLoading}
            />
            <KPICard
              title="Avg Days to Sell"
              value={
                inventoryData
                  ? inventoryData.avgDaysToSell > 0
                    ? `${inventoryData.avgDaysToSell}d`
                    : "\u2014"
                  : "\u2014"
              }
              subtitle="acquired to sold"
              loading={inventoryLoading}
            />
            <KPICard
              title="In Stock"
              value={inventoryData?.inStockCount?.toString() ?? "\u2014"}
              subtitle="active items"
              loading={inventoryLoading}
            />
            <KPICard
              title="Stock Value"
              value={
                inventoryData
                  ? formatCurrency(inventoryData.inStockValueAUD)
                  : "\u2014"
              }
              subtitle="sell price (AUD)"
              loading={inventoryLoading}
            />
          </div>

          {/* Inventory charts */}
          <Section title="Inventory Overview" loading={inventoryLoading}>
            {inventoryData && (
              <InventoryAnalyticsSection data={inventoryData} />
            )}
          </Section>
        </>
      )}
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
                  name === "count" ? (value ?? 0) : formatCurrency((value as number) ?? 0),
                  name === "count" ? "Quotes" : "Avg AUD",
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
              {formatCurrency(data.gradeRevisions.avgRevisionDeltaAUD)}{" "}
              per revised quote
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
                    : formatCurrency((value as number) ?? 0),
                  name === "count" ? "Quotes" : "Value (AUD)",
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
              Top Partners by Value (AUD)
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
                    formatCurrency((value as number) ?? 0),
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
                  dataKey="totalAUD"
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

// ---------------------------------------------------------------------------
// Inventory Analytics
// ---------------------------------------------------------------------------

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: 13,
};

function InventoryAnalyticsSection({ data }: { data: InventoryData }) {
  const totalItems =
    data.statusDistribution.reduce((s, d) => s + d.count, 0);

  if (totalItems === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No inventory items found
      </p>
    );
  }

  const statusChartData = data.statusDistribution.map((d) => ({
    ...d,
    label: INV_STATUS_LABELS[d.status] ?? d.status,
  }));

  return (
    <div className="space-y-8">
      {/* Row 1: Status Distribution + Inventory Aging */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Distribution */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusChartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {statusChartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Inventory Aging */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Inventory Aging (active items)
          </h3>
          {data.aging.brackets.some((b) => b.count > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.aging.brackets}>
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => [value ?? 0, "Items"]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS[4]}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-2">
                Average days in stock: {data.aging.avgDaysInStock}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No active items
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Category Performance */}
      {data.categoryPerformance.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Category Performance (sold in period)
          </h3>
          <div className="grid gap-6 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={Math.max(200, data.categoryPerformance.length * 50)}>
              <BarChart
                data={data.categoryPerformance}
                layout="vertical"
                margin={{ left: 10 }}
              >
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={80}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "unitsSold") return [value ?? 0, "Units Sold"];
                    return [formatCurrency((value as number) ?? 0), name === "margin" ? "Margin" : "Revenue"];
                  }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar
                  dataKey="margin"
                  fill={CHART_COLORS[1]}
                  radius={[0, 4, 4, 0]}
                  name="margin"
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Category table */}
            <div className="text-sm">
              <div className="grid grid-cols-5 gap-2 font-medium text-muted-foreground mb-2 text-xs">
                <span>Category</span>
                <span className="text-right">Units</span>
                <span className="text-right">Revenue</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Margin</span>
              </div>
              {data.categoryPerformance.map((cat) => (
                <div
                  key={cat.category}
                  className="grid grid-cols-5 gap-2 py-1 border-t border-border text-xs"
                >
                  <span className="font-medium">{cat.category}</span>
                  <span className="text-right">{cat.unitsSold}</span>
                  <span className="text-right tabular-nums">
                    {formatCurrency(cat.revenueAUD)}
                  </span>
                  <span className="text-right tabular-nums">
                    {formatCurrency(cat.costAUD)}
                  </span>
                  <span
                    className={cn(
                      "text-right tabular-nums font-medium",
                      cat.margin >= 0 ? "text-green-600" : "text-red-500"
                    )}
                  >
                    {formatCurrency(cat.margin)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Row 3: Source Analysis */}
      {data.sourceAnalysis.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Source Analysis (sold in period)
          </h3>
          <div className="grid gap-6 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={Math.max(160, data.sourceAnalysis.length * 50)}>
              <BarChart
                data={data.sourceAnalysis.map((d) => ({
                  ...d,
                  label:
                    d.sourceType === "trade-in"
                      ? "Trade-in"
                      : d.sourceType === "bulk"
                        ? "Bulk"
                        : d.sourceType,
                }))}
                layout="vertical"
                margin={{ left: 10 }}
              >
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={80}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    name === "unitsSold"
                      ? (value ?? 0)
                      : formatCurrency((value as number) ?? 0),
                    name === "unitsSold" ? "Units" : name === "margin" ? "Margin" : "Revenue",
                  ]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar
                  dataKey="margin"
                  fill={CHART_COLORS[2]}
                  radius={[0, 4, 4, 0]}
                  name="margin"
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Source table */}
            <div className="text-sm">
              <div className="grid grid-cols-5 gap-2 font-medium text-muted-foreground mb-2 text-xs">
                <span>Source</span>
                <span className="text-right">Units</span>
                <span className="text-right">Revenue</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Margin</span>
              </div>
              {data.sourceAnalysis.map((src) => (
                <div
                  key={src.sourceType}
                  className="grid grid-cols-5 gap-2 py-1 border-t border-border text-xs"
                >
                  <span className="font-medium">
                    {src.sourceType === "trade-in"
                      ? "Trade-in"
                      : src.sourceType === "bulk"
                        ? "Bulk"
                        : src.sourceType}
                  </span>
                  <span className="text-right">{src.unitsSold}</span>
                  <span className="text-right tabular-nums">
                    {formatCurrency(src.revenueAUD)}
                  </span>
                  <span className="text-right tabular-nums">
                    {formatCurrency(src.costAUD)}
                  </span>
                  <span
                    className={cn(
                      "text-right tabular-nums font-medium",
                      src.margin >= 0 ? "text-green-600" : "text-red-500"
                    )}
                  >
                    {formatCurrency(src.margin)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state for sold metrics */}
      {data.soldCount === 0 &&
        data.categoryPerformance.length === 0 &&
        data.sourceAnalysis.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No sold items in this date range
          </p>
        )}
    </div>
  );
}
