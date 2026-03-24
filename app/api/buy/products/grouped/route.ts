import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { toModelSlug, toModelImagePath } from "@/lib/slugify";

// ---------------------------------------------------------------------------
// GET /api/buy/products/grouped — Products grouped by make+model
// Query params:
//   ?category=  — filter by device category
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.trim() ?? "";

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

    // Group inventory items by make+model
    const groupMap = new Map<
      string,
      {
        slug: string;
        make: string;
        model: string;
        category: string;
        minPriceAUD: number;
        unitCount: number;
        storages: Set<string>;
        grades: Set<string>;
        fallbackImage: string | null;
      }
    >();

    for (const { data } of inventoryDocs) {
      const device = deviceMap.get(data.deviceRef as string);
      if (!device) continue;

      const make = (device.make as string) ?? "";
      const model = (device.model as string) ?? "";
      const storage = (device.storage as string) ?? "";
      const slug = toModelSlug(make, model);
      const priceAUD = (data.sellPriceAUD as number) ?? 0;
      const grade = (data.cosmeticGrade as string) ?? "";
      const images = (data.images as string[]) ?? [];
      const itemCategory = (data.category as string) ?? "Phone";

      const existing = groupMap.get(slug);

      if (existing) {
        existing.unitCount++;
        if (priceAUD < existing.minPriceAUD) {
          existing.minPriceAUD = priceAUD;
        }
        if (storage) existing.storages.add(storage);
        if (grade) existing.grades.add(grade);
        if (!existing.fallbackImage && images.length > 0) {
          existing.fallbackImage = images[0];
        }
      } else {
        groupMap.set(slug, {
          slug,
          make,
          model,
          category: itemCategory,
          minPriceAUD: priceAUD,
          unitCount: 1,
          storages: new Set(storage ? [storage] : []),
          grades: new Set(grade ? [grade] : []),
          fallbackImage: images.length > 0 ? images[0] : null,
        });
      }
    }

    // Convert to response array
    // Hero image: static file from /public/devices/ derived from model name,
    // falls back to first inventory photo
    const groups = Array.from(groupMap.values())
      .map((g) => ({
        slug: g.slug,
        make: g.make,
        model: g.model,
        category: g.category,
        minPriceAUD: g.minPriceAUD,
        unitCount: g.unitCount,
        storages: Array.from(g.storages).sort(),
        grades: Array.from(g.grades).sort(),
        heroImage: toModelImagePath(g.model),
        fallbackImage: g.fallbackImage,
      }))
      .sort((a, b) => {
        const makeCompare = a.make.localeCompare(b.make);
        if (makeCompare !== 0) return makeCompare;
        return a.model.localeCompare(b.model);
      });

    const response = NextResponse.json({
      groups,
      total: groups.length,
    });

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=120"
    );
    return response;
  } catch (error) {
    console.error("Error fetching grouped products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
