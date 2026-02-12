import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getCached, setCache } from "@/lib/analytics-cache";

const STATUS_ORDER = [
  "quoted",
  "accepted",
  "shipped",
  "received",
  "inspected",
  "paid",
];

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

  const cacheKey = `funnel:${from}:${to}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    let query: FirebaseFirestore.Query = adminDb
      .collection("quotes")
      .where("createdAt", ">=", fromDate)
      .where("createdAt", "<=", toDate)
      .orderBy("createdAt", "desc");

    const snapshot = await query.get();

    const stageCounts: Record<string, number> = {};
    STATUS_ORDER.forEach((s) => (stageCounts[s] = 0));
    let cancelled = 0;

    snapshot.docs.forEach((doc) => {
      const status = doc.data().status as string;
      if (status === "cancelled") {
        cancelled++;
        return;
      }
      const idx = STATUS_ORDER.indexOf(status);
      if (idx === -1) return;
      // Cumulative: a quote in "paid" has passed through all prior stages
      for (let i = 0; i <= idx; i++) {
        stageCounts[STATUS_ORDER[i]]++;
      }
    });

    const stages = STATUS_ORDER.map((status) => ({
      status,
      count: stageCounts[status],
    }));

    const result = {
      stages,
      cancelled,
      total: snapshot.docs.length,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching funnel data:", error);
    return NextResponse.json(
      { error: "Failed to fetch funnel data" },
      { status: 500 }
    );
  }
}
