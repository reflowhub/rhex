import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getCached, setCache } from "@/lib/analytics-cache";

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

  const cacheKey = `traffic:${from}:${to}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const snapshot = await adminDb
      .collection("sessions")
      .where("startedAt", ">=", fromDate)
      .where("startedAt", "<=", toDate)
      .get();

    let totalVisitors = 0;
    let totalDuration = 0;
    let totalBounced = 0;
    let totalPageViews = 0;

    const dailyMap = new Map<
      string,
      { visitors: number; pageViews: number; totalDuration: number; bounced: number }
    >();
    const sourceMap = new Map<string, number>();
    const pageMap = new Map<string, { views: number; sessions: Set<string> }>();
    const countryMap = new Map<
      string,
      { country: string; countryCode: string; visitors: number }
    >();

    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      totalVisitors++;
      totalDuration += d.duration || 0;
      if (d.bounced) totalBounced++;
      totalPageViews += d.pagesVisited || 1;

      // Daily
      const startedAt = d.startedAt?.toDate?.() ?? new Date(d.startedAt);
      const dateKey = startedAt.toISOString().split("T")[0];
      const day = dailyMap.get(dateKey) ?? {
        visitors: 0,
        pageViews: 0,
        totalDuration: 0,
        bounced: 0,
      };
      day.visitors++;
      day.pageViews += d.pagesVisited || 1;
      day.totalDuration += d.duration || 0;
      if (d.bounced) day.bounced++;
      dailyMap.set(dateKey, day);

      // Source
      const source = d.source || "direct";
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

      // Entry page
      const entryPage = d.entryPage || "/";
      const pageEntry = pageMap.get(entryPage) ?? {
        views: 0,
        sessions: new Set<string>(),
      };
      pageEntry.views += d.pagesVisited || 1;
      pageEntry.sessions.add(d.sessionId);
      pageMap.set(entryPage, pageEntry);

      // Country
      const countryKey = d.countryCode || "??";
      const countryEntry = countryMap.get(countryKey) ?? {
        country: d.country || "Unknown",
        countryCode: countryKey,
        visitors: 0,
      };
      countryEntry.visitors++;
      countryMap.set(countryKey, countryEntry);
    });

    const avgDuration =
      totalVisitors > 0 ? Math.round(totalDuration / totalVisitors) : 0;
    const bounceRate =
      totalVisitors > 0
        ? Math.round((totalBounced / totalVisitors) * 1000) / 10
        : 0;

    const daily = Array.from(dailyMap.entries())
      .map(([date, d]) => ({
        date,
        visitors: d.visitors,
        pageViews: d.pageViews,
        avgDuration:
          d.visitors > 0 ? Math.round(d.totalDuration / d.visitors) : 0,
        bounceRate:
          d.visitors > 0
            ? Math.round((d.bounced / d.visitors) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const sources = Array.from(sourceMap.entries())
      .map(([source, count]) => ({
        source,
        count,
        percentage:
          totalVisitors > 0
            ? Math.round((count / totalVisitors) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topPages = Array.from(pageMap.entries())
      .map(([page, { views, sessions }]) => ({
        page,
        views,
        uniqueVisitors: sessions.size,
      }))
      .sort((a, b) => b.uniqueVisitors - a.uniqueVisitors)
      .slice(0, 10);

    const countries = Array.from(countryMap.values()).sort(
      (a, b) => b.visitors - a.visitors
    );

    const result = {
      summary: { totalVisitors, avgDuration, bounceRate, totalPageViews },
      daily,
      sources,
      topPages,
      countries,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching traffic data:", error);
    return NextResponse.json(
      { error: "Failed to fetch traffic data" },
      { status: 500 }
    );
  }
}
