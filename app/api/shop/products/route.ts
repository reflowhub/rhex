import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/shop/products — Public product listing (listed inventory)
// Query params:
//   ?category=  — filter by device category
//   ?make=      — filter by manufacturer
//   ?grade=     — filter by cosmetic grade
//   ?page=      — page number (default 1)
//   ?limit=     — items per page (default 24, max 48)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.trim() ?? "";
    const make = searchParams.get("make")?.trim() ?? "";
    const grade = searchParams.get("grade")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") ?? "24", 10))
    );

    // Build Firestore query — only listed items with "listed" status
    let query: FirebaseFirestore.Query = adminDb
      .collection("inventory")
      .where("listed", "==", true)
      .where("status", "==", "listed");

    if (category) {
      query = query.where("category", "==", category);
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    // Collect unique deviceRefs for batch lookup
    const deviceIdSet = new Set<string>();
    const inventoryDocs: { id: string; data: Record<string, unknown> }[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      inventoryDocs.push({ id: doc.id, data });
      if (data.deviceRef && typeof data.deviceRef === "string") {
        deviceIdSet.add(data.deviceRef);
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

    // Build response — PUBLIC fields only (no cost, serial, source info)
    let items = inventoryDocs.map(({ id, data }) => {
      const device = deviceMap.get(data.deviceRef as string);
      return {
        id,
        make: (device?.make as string) ?? "",
        model: (device?.model as string) ?? "",
        storage: (device?.storage as string) ?? "",
        category: data.category ?? "Phone",
        cosmeticGrade: data.cosmeticGrade ?? "",
        batteryHealth: data.batteryHealth ?? null,
        sellPriceNZD: data.sellPriceNZD ?? 0,
        sellPriceAUD: data.sellPriceAUD ?? null,
        images: (data.images as string[]) ?? [],
      };
    });

    // In-memory filters for make and grade
    if (make) {
      items = items.filter(
        (item) => item.make.toLowerCase() === make.toLowerCase()
      );
    }
    if (grade) {
      items = items.filter((item) => item.cosmeticGrade === grade);
    }

    // Pagination
    const total = items.length;
    const offset = (page - 1) * limit;
    const paginated = items.slice(offset, offset + limit);

    const response = NextResponse.json({
      items: paginated,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=120"
    );
    return response;
  } catch (error) {
    console.error("Error fetching shop products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
