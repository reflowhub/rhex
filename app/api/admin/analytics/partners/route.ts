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

  const cacheKey = `partners:${from}:${to}`;
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

    // Aggregate per partner
    let directCount = 0;
    let directValueNZD = 0;
    let partnerCount = 0;
    let partnerValueNZD = 0;

    const modeMap = new Map<string, { count: number; totalNZD: number }>();
    const partnerAgg = new Map<
      string,
      { count: number; totalNZD: number; mode: string }
    >();

    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      const priceNZD = (d.quotePriceNZD as number) ?? 0;
      const partnerId = d.partnerId as string | undefined;
      const partnerMode = (d.partnerMode as string) ?? "";

      if (!partnerId) {
        directCount++;
        directValueNZD += priceNZD;
      } else {
        partnerCount++;
        partnerValueNZD += priceNZD;

        // Mode split
        const modeKey = partnerMode || "Unknown";
        const modeEntry = modeMap.get(modeKey) ?? { count: 0, totalNZD: 0 };
        modeEntry.count++;
        modeEntry.totalNZD += priceNZD;
        modeMap.set(modeKey, modeEntry);

        // Per-partner aggregation
        const pEntry = partnerAgg.get(partnerId) ?? {
          count: 0,
          totalNZD: 0,
          mode: partnerMode,
        };
        pEntry.count++;
        pEntry.totalNZD += priceNZD;
        partnerAgg.set(partnerId, pEntry);
      }
    });

    // Batch-fetch partner names
    const partnerIds = Array.from(partnerAgg.keys());
    const partnerNameMap = new Map<string, string>();

    if (partnerIds.length > 0) {
      const refs = partnerIds.map((id) =>
        adminDb.collection("partners").doc(id)
      );
      const docs = await adminDb.getAll(...refs);
      docs.forEach((doc) => {
        if (doc.exists) {
          partnerNameMap.set(
            doc.id,
            (doc.data()?.name as string) ?? doc.id
          );
        }
      });
    }

    // Build top-10 lists
    const partnerEntries = Array.from(partnerAgg.entries()).map(
      ([id, { count, totalNZD, mode }]) => ({
        partnerId: id,
        partnerName: partnerNameMap.get(id) ?? id,
        mode,
        count,
        totalNZD: Math.round(totalNZD * 100) / 100,
      })
    );

    const topByCount = [...partnerEntries]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topByValue = [...partnerEntries]
      .sort((a, b) => b.totalNZD - a.totalNZD)
      .slice(0, 10);

    const result = {
      directVsPartner: [
        {
          type: "direct" as const,
          count: directCount,
          totalNZD: Math.round(directValueNZD * 100) / 100,
        },
        {
          type: "partner" as const,
          count: partnerCount,
          totalNZD: Math.round(partnerValueNZD * 100) / 100,
        },
      ],
      modeSplit: Array.from(modeMap.entries()).map(
        ([mode, { count, totalNZD }]) => ({
          mode: mode === "A" ? "Mode A (Referral)" : mode === "B" ? "Mode B (Direct)" : mode,
          count,
          totalNZD: Math.round(totalNZD * 100) / 100,
        })
      ),
      topPartnersByCount: topByCount,
      topPartnersByValue: topByValue,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching partner analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch partner analytics" },
      { status: 500 }
    );
  }
}
