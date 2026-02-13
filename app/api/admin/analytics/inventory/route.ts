import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getCached, setCache } from "@/lib/analytics-cache";
import { getTodayFXRate } from "@/lib/fx";

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/inventory — Inventory margin & analytics
//
// Query params:
//   ?from=YYYY-MM-DD  — start of date range (for sold-item metrics)
//   ?to=YYYY-MM-DD    — end of date range
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = ["received", "inspecting", "refurbishing", "listed"];

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

export async function GET(request: NextRequest) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params are required" },
      { status: 400 }
    );
  }

  const cacheKey = `inventory-analytics:${from}:${to}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const fromDate = new Date(from);
    const toDate_ = new Date(to);
    toDate_.setHours(23, 59, 59, 999);

    const [snapshot, fx] = await Promise.all([
      adminDb.collection("inventory").get(),
      getTodayFXRate(),
    ]);
    const now = new Date();

    // Accumulators
    let soldCount = 0;
    let revenueAUD = 0;
    let totalCostNZD = 0;
    let daysToSellSum = 0;
    let daysToSellCount = 0;

    let inStockCount = 0;
    let inStockValueAUD = 0;

    const statusMap = new Map<string, number>();
    const categoryMap = new Map<
      string,
      { unitsSold: number; revenueAUD: number; costNZD: number }
    >();
    const sourceMap = new Map<
      string,
      { unitsSold: number; revenueAUD: number; costNZD: number }
    >();

    // Aging brackets for active items
    let agingDaysSum = 0;
    let agingCount = 0;
    const agingBrackets = [0, 0, 0, 0, 0]; // 0-7, 8-30, 31-60, 61-90, 90+

    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      const status = (d.status as string) ?? "received";
      const sellPriceAUD = (d.sellPriceAUD as number) ?? 0;
      const costNZD = (d.costNZD as number) ?? 0;
      const category = (d.category as string) ?? "Phone";
      const sourceType = (d.sourceType as string) ?? "trade-in";
      const acquiredAt = toDate(d.acquiredAt);
      const updatedAt = toDate(d.updatedAt);

      // Status distribution (all items)
      statusMap.set(status, (statusMap.get(status) ?? 0) + 1);

      // Active items (in-stock snapshot)
      if (ACTIVE_STATUSES.includes(status)) {
        inStockCount++;
        inStockValueAUD += sellPriceAUD;

        // Aging
        if (acquiredAt) {
          const days = daysBetween(acquiredAt, now);
          agingDaysSum += days;
          agingCount++;
          if (days <= 7) agingBrackets[0]++;
          else if (days <= 30) agingBrackets[1]++;
          else if (days <= 60) agingBrackets[2]++;
          else if (days <= 90) agingBrackets[3]++;
          else agingBrackets[4]++;
        }
      }

      // Sold items in date range (use updatedAt as soldAt proxy)
      if (status === "sold" && updatedAt) {
        if (updatedAt >= fromDate && updatedAt <= toDate_) {
          soldCount++;
          revenueAUD += sellPriceAUD;
          totalCostNZD += costNZD;

          // Days to sell
          if (acquiredAt) {
            const days = daysBetween(acquiredAt, updatedAt);
            daysToSellSum += days;
            daysToSellCount++;
          }

          // Category performance
          const catEntry = categoryMap.get(category) ?? {
            unitsSold: 0,
            revenueAUD: 0,
            costNZD: 0,
          };
          catEntry.unitsSold++;
          catEntry.revenueAUD += sellPriceAUD;
          catEntry.costNZD += costNZD;
          categoryMap.set(category, catEntry);

          // Source analysis
          const srcEntry = sourceMap.get(sourceType) ?? {
            unitsSold: 0,
            revenueAUD: 0,
            costNZD: 0,
          };
          srcEntry.unitsSold++;
          srcEntry.revenueAUD += sellPriceAUD;
          srcEntry.costNZD += costNZD;
          sourceMap.set(sourceType, srcEntry);
        }
      }
    });

    const totalCostAUD = totalCostNZD * fx.NZD_AUD;
    const totalMargin = revenueAUD - totalCostAUD;

    const result = {
      // KPIs (sold in date range)
      soldCount,
      revenueAUD: Math.round(revenueAUD * 100) / 100,
      totalCostNZD: Math.round(totalCostNZD * 100) / 100,
      totalCostAUD: Math.round(totalCostAUD * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      avgMarginPerUnit:
        soldCount > 0
          ? Math.round((totalMargin / soldCount) * 100) / 100
          : 0,
      avgDaysToSell:
        daysToSellCount > 0
          ? Math.round(daysToSellSum / daysToSellCount)
          : 0,

      // Snapshot (all items)
      inStockCount,
      inStockValueAUD: Math.round(inStockValueAUD * 100) / 100,
      statusDistribution: Array.from(statusMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),

      // Category performance (sold in date range)
      categoryPerformance: Array.from(categoryMap.entries())
        .map(([category, data]) => {
          const costAUD = data.costNZD * fx.NZD_AUD;
          return {
            category,
            unitsSold: data.unitsSold,
            revenueAUD: Math.round(data.revenueAUD * 100) / 100,
            costAUD: Math.round(costAUD * 100) / 100,
            margin: Math.round((data.revenueAUD - costAUD) * 100) / 100,
            avgMargin:
              data.unitsSold > 0
                ? Math.round(
                    ((data.revenueAUD - costAUD) / data.unitsSold) * 100
                  ) / 100
                : 0,
          };
        })
        .sort((a, b) => b.unitsSold - a.unitsSold),

      // Source analysis (sold in date range)
      sourceAnalysis: Array.from(sourceMap.entries())
        .map(([sourceType, data]) => {
          const costAUD = data.costNZD * fx.NZD_AUD;
          return {
            sourceType,
            unitsSold: data.unitsSold,
            revenueAUD: Math.round(data.revenueAUD * 100) / 100,
            costAUD: Math.round(costAUD * 100) / 100,
            margin: Math.round((data.revenueAUD - costAUD) * 100) / 100,
          };
        })
        .sort((a, b) => b.unitsSold - a.unitsSold),

      // Aging (active items)
      aging: {
        avgDaysInStock:
          agingCount > 0 ? Math.round(agingDaysSum / agingCount) : 0,
        brackets: [
          { label: "0–7d", count: agingBrackets[0] },
          { label: "8–30d", count: agingBrackets[1] },
          { label: "31–60d", count: agingBrackets[2] },
          { label: "61–90d", count: agingBrackets[3] },
          { label: "90d+", count: agingBrackets[4] },
        ],
      },
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching inventory analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory analytics" },
      { status: 500 }
    );
  }
}
