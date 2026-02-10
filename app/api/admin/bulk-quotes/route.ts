import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate: () => Date };
    return ts.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/admin/bulk-quotes — List all bulk quotes with optional filters
// Query params:
//   ?status=   — filter by quote status
//   ?search=   — search by business name or email
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter =
      searchParams.get("status")?.toLowerCase().trim() ?? "";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";

    let query: FirebaseFirestore.Query = adminDb.collection("bulkQuotes");

    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    // Batch-fetch partner names
    const partnerIdSet = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const pid = doc.data().partnerId;
      if (pid && typeof pid === "string") partnerIdSet.add(pid);
    });

    const partnerMap = new Map<string, string>();
    const partnerIds = Array.from(partnerIdSet);
    if (partnerIds.length > 0) {
      const partnerRefs = partnerIds.map((pid) =>
        adminDb.collection("partners").doc(pid)
      );
      const partnerDocs = await adminDb.getAll(...partnerRefs);
      partnerDocs.forEach((doc) => {
        if (doc.exists) {
          const d = doc.data() as Record<string, unknown>;
          partnerMap.set(doc.id, (d.name as string) ?? "");
        }
      });
    }

    let quotes = snapshot.docs.map((doc) => {
      const data = doc.data();
      const partnerId = (data.partnerId as string) ?? null;
      return {
        id: doc.id,
        businessName: data.businessName ?? null,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        type: data.type ?? "manifest",
        assumedGrade: data.assumedGrade ?? "C",
        totalDevices: data.totalDevices ?? 0,
        totalIndicativeNZD: data.totalIndicativeNZD ?? 0,
        matchedCount: data.matchedCount ?? 0,
        unmatchedCount: data.unmatchedCount ?? 0,
        status: data.status ?? "estimated",
        partnerId,
        partnerName: partnerId ? (partnerMap.get(partnerId) ?? null) : null,
        partnerMode: data.partnerMode ?? null,
        createdAt: serializeTimestamp(data.createdAt),
        acceptedAt: serializeTimestamp(data.acceptedAt),
      };
    });

    // Apply in-memory search filter
    if (search) {
      quotes = quotes.filter((q) => {
        const name = String(q.businessName ?? "").toLowerCase();
        const email = String(q.contactEmail ?? "").toLowerCase();
        const combined = `${name} ${email}`;
        const searchWords = search.split(/\s+/).filter(Boolean);
        return searchWords.every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(quotes);
  } catch (error) {
    console.error("Error fetching bulk quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch bulk quotes" },
      { status: 500 }
    );
  }
}
