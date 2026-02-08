import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/admin/quotes — List all quotes with optional filters
// Query params:
//   ?status=   — filter by quote status
//   ?search=   — search by customer name or email
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status")?.toLowerCase().trim() ?? "";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";

    // Build Firestore query
    let query: FirebaseFirestore.Query = adminDb.collection("quotes");

    // Apply status filter at the query level if provided
    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }

    // Always order by createdAt descending (most recent first)
    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    // Collect unique deviceIds for batch lookup
    const deviceIdSet = new Set<string>();
    const quoteDocs: { id: string; data: Record<string, unknown> }[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      quoteDocs.push({ id: doc.id, data });
      if (data.deviceId && typeof data.deviceId === "string") {
        deviceIdSet.add(data.deviceId);
      }
    });

    // Batch-fetch device documents
    const deviceMap = new Map<string, Record<string, unknown>>();
    const deviceIds = Array.from(deviceIdSet);

    if (deviceIds.length > 0) {
      const deviceRefs = deviceIds.map((id) =>
        adminDb.collection("devices").doc(id)
      );
      const deviceDocs = await adminDb.getAll(...deviceRefs);
      deviceDocs.forEach((doc) => {
        if (doc.exists) {
          deviceMap.set(doc.id, doc.data() as Record<string, unknown>);
        }
      });
    }

    // Build response array with device info joined in
    let quotes: Record<string, unknown>[] = quoteDocs.map(({ id, data }) => {
      const device = deviceMap.get(data.deviceId as string);
      return {
        id,
        deviceId: data.deviceId,
        deviceMake: device?.make ?? "",
        deviceModel: device?.model ?? "",
        deviceStorage: device?.storage ?? "",
        grade: data.grade,
        quotePriceNZD: data.quotePriceNZD,
        displayCurrency: data.displayCurrency,
        status: data.status,
        customerName: data.customerName ?? null,
        customerEmail: data.customerEmail ?? null,
        customerPhone: data.customerPhone ?? null,
        createdAt: serializeTimestamp(data.createdAt),
        expiresAt: serializeTimestamp(data.expiresAt),
        acceptedAt: serializeTimestamp(data.acceptedAt),
        inspectionGrade: data.inspectionGrade ?? null,
        revisedPriceNZD: data.revisedPriceNZD ?? null,
      };
    });

    // Apply in-memory search filter for customer name/email
    if (search) {
      quotes = quotes.filter((q) => {
        const name = String(q.customerName ?? "").toLowerCase();
        const email = String(q.customerEmail ?? "").toLowerCase();
        const combined = `${name} ${email}`;
        const searchWords = search.split(/\s+/).filter(Boolean);
        return searchWords.every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(quotes);
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  // Firestore Timestamp objects have a toDate() method
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate: () => Date };
    return ts.toDate().toISOString();
  }
  // Already a string or Date
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
