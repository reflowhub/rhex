import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getCached, setCache } from "@/lib/analytics-cache";
import { getTodayFXRate } from "@/lib/fx";

const GRADE_ORDER = ["A", "B", "C", "D", "E"];

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

  const cacheKey = `revenue:${from}:${to}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const snapshot = await adminDb
      .collection("quotes")
      .where("createdAt", ">=", fromDate)
      .where("createdAt", "<=", toDate)
      .orderBy("createdAt", "desc")
      .get();

    const fx = await getTodayFXRate();

    let quoteCount = 0;
    let paidCount = 0;
    let paidValueNZD = 0;

    const gradeMap = new Map<string, { count: number; totalNZD: number }>();
    const currencyMap = new Map<string, number>();
    const dailyMap = new Map<string, { count: number; totalNZD: number }>();

    // Grade revision tracking
    let inspectedCount = 0;
    let revisedCount = 0;
    let upgrades = 0;
    let downgrades = 0;
    let revisionDeltaSum = 0;

    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      quoteCount++;

      // Grade distribution (all quotes)
      const grade = (d.grade as string) ?? "?";
      const existing = gradeMap.get(grade) ?? { count: 0, totalNZD: 0 };
      existing.count++;
      existing.totalNZD += (d.quotePriceNZD as number) ?? 0;
      gradeMap.set(grade, existing);

      // Currency split
      const currency = (d.displayCurrency as string) ?? "NZD";
      currencyMap.set(currency, (currencyMap.get(currency) ?? 0) + 1);

      // Daily volume
      const createdAt = d.createdAt?.toDate?.() ?? new Date(d.createdAt);
      const dateKey = createdAt.toISOString().split("T")[0];
      const dayEntry = dailyMap.get(dateKey) ?? { count: 0, totalNZD: 0 };
      dayEntry.count++;
      dayEntry.totalNZD += (d.quotePriceNZD as number) ?? 0;
      dailyMap.set(dateKey, dayEntry);

      // Paid quotes (revenue)
      if (d.status === "paid") {
        paidCount++;
        paidValueNZD += (d.revisedPriceNZD as number) ?? (d.quotePriceNZD as number) ?? 0;
      }

      // Grade revision analysis (inspected or paid quotes)
      if (d.inspectionGrade) {
        inspectedCount++;
        const origIdx = GRADE_ORDER.indexOf(d.grade as string);
        const inspIdx = GRADE_ORDER.indexOf(d.inspectionGrade as string);
        if (origIdx !== -1 && inspIdx !== -1 && origIdx !== inspIdx) {
          revisedCount++;
          if (inspIdx < origIdx) upgrades++;
          else downgrades++;
          const origPrice = (d.quotePriceNZD as number) ?? 0;
          const revisedPrice = (d.revisedPriceNZD as number) ?? origPrice;
          revisionDeltaSum += revisedPrice - origPrice;
        }
      }
    });

    const gradeDistribution = Array.from(gradeMap.entries())
      .map(([grade, { count, totalNZD }]) => ({
        grade,
        count,
        totalNZD: Math.round(totalNZD * 100) / 100,
        avgNZD: count > 0 ? Math.round((totalNZD / count) * 100) / 100 : 0,
      }))
      .sort((a, b) => {
        const ai = GRADE_ORDER.indexOf(a.grade);
        const bi = GRADE_ORDER.indexOf(b.grade);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

    const currencySplit = Array.from(currencyMap.entries()).map(
      ([currency, count]) => ({ currency, count })
    );

    const dailyVolume = Array.from(dailyMap.entries())
      .map(([date, { count, totalNZD }]) => ({
        date,
        count,
        totalNZD: Math.round(totalNZD * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const result = {
      quoteCount,
      paidCount,
      paidValueNZD: Math.round(paidValueNZD * 100) / 100,
      paidValueAUD: Math.round(paidValueNZD * fx.NZD_AUD * 100) / 100,
      averageValueNZD:
        paidCount > 0
          ? Math.round((paidValueNZD / paidCount) * 100) / 100
          : 0,
      averageValueAUD:
        paidCount > 0
          ? Math.round(((paidValueNZD * fx.NZD_AUD) / paidCount) * 100) / 100
          : 0,
      fxRate: fx.NZD_AUD,
      gradeDistribution,
      currencySplit,
      gradeRevisions: {
        total: inspectedCount,
        revised: revisedCount,
        upgrades,
        downgrades,
        avgRevisionDeltaNZD:
          revisedCount > 0
            ? Math.round((revisionDeltaSum / revisedCount) * 100) / 100
            : 0,
      },
      dailyVolume,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching revenue data:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
