import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";

// ---------------------------------------------------------------------------
// GET /api/partner/quotes — List quotes for the authenticated partner
// Query params:
//   ?status=  — filter by quote status
//   ?search=  — search by customer name/email or device
//   ?type=    — "quote" | "bulkQuote" (default: both)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status")?.toLowerCase().trim() ?? "";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";
    const typeFilter = searchParams.get("type")?.toLowerCase().trim() ?? "";

    const items: Record<string, unknown>[] = [];

    // Fetch single quotes
    if (typeFilter !== "bulkquote") {
      let quoteQuery: FirebaseFirestore.Query = adminDb
        .collection("quotes")
        .where("partnerId", "==", partner.id);

      if (statusFilter) {
        quoteQuery = quoteQuery.where("status", "==", statusFilter);
      }

      quoteQuery = quoteQuery.orderBy("createdAt", "desc");
      const quoteSnapshot = await quoteQuery.get();

      // Batch-fetch device info
      const deviceIdSet = new Set<string>();
      const quoteDocs: { id: string; data: Record<string, unknown> }[] = [];

      quoteSnapshot.docs.forEach((doc) => {
        const data = doc.data() as Record<string, unknown>;
        quoteDocs.push({ id: doc.id, data });
        if (data.deviceId && typeof data.deviceId === "string") {
          deviceIdSet.add(data.deviceId);
        }
      });

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

      quoteDocs.forEach(({ id, data }) => {
        const device = deviceMap.get(data.deviceId as string);
        items.push({
          id,
          type: "quote",
          deviceId: data.deviceId,
          deviceMake: device?.make ?? "",
          deviceModel: device?.model ?? "",
          deviceStorage: device?.storage ?? "",
          grade: data.grade,
          quotePriceNZD: data.quotePriceNZD,
          publicPriceNZD: data.publicPriceNZD ?? null,
          status: data.status,
          partnerMode: data.partnerMode ?? null,
          customerName: data.customerName ?? null,
          customerEmail: data.customerEmail ?? null,
          createdAt: serializeTimestamp(data.createdAt),
        });
      });
    }

    // Fetch bulk quotes
    if (typeFilter !== "quote") {
      let bulkQuery: FirebaseFirestore.Query = adminDb
        .collection("bulkQuotes")
        .where("partnerId", "==", partner.id);

      if (statusFilter) {
        bulkQuery = bulkQuery.where("status", "==", statusFilter);
      }

      bulkQuery = bulkQuery.orderBy("createdAt", "desc");
      const bulkSnapshot = await bulkQuery.get();

      bulkSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: "bulkQuote",
          deviceCount: data.items?.length ?? 0,
          totalNZD: data.totalNZD ?? null,
          status: data.status,
          partnerMode: data.partnerMode ?? null,
          customerName: data.customerName ?? data.businessName ?? null,
          customerEmail: data.customerEmail ?? null,
          createdAt: serializeTimestamp(data.createdAt),
        });
      });
    }

    // Sort all items by date descending
    items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
      return dateB - dateA;
    });

    // Apply search filter
    let filtered = items;
    if (search) {
      filtered = items.filter((item) => {
        const combined = [
          item.customerName,
          item.customerEmail,
          item.deviceMake,
          item.deviceModel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const searchWords = search.split(/\s+/).filter(Boolean);
        return searchWords.every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error fetching partner quotes:", error);
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
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate: () => Date };
    return ts.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
