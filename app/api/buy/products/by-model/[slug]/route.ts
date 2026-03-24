import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { toModelSlug } from "@/lib/slugify";

// ---------------------------------------------------------------------------
// GET /api/buy/products/by-model/[slug] — All listed units for a model
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Query all listed inventory
    const snapshot = await adminDb
      .collection("inventory")
      .where("listed", "==", true)
      .where("status", "==", "listed")
      .orderBy("createdAt", "desc")
      .get();

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

    // Filter items matching the slug
    let make = "";
    let model = "";
    let heroImage: string | null = null;

    const items = inventoryDocs
      .map(({ id, data }) => {
        const device = deviceMap.get(data.deviceRef as string);
        if (!device) return null;

        const itemMake = (device.make as string) ?? "";
        const itemModel = (device.model as string) ?? "";

        if (toModelSlug(itemMake, itemModel) !== slug) return null;

        // Capture make/model from first match
        if (!make) {
          make = itemMake;
          model = itemModel;
        }
        if (!heroImage && device.heroImage) {
          heroImage = device.heroImage as string;
        }

        return {
          id,
          make: itemMake,
          model: itemModel,
          storage: (device.storage as string) ?? "",
          category: (data.category as string) ?? "Phone",
          cosmeticGrade: (data.cosmeticGrade as string) ?? "",
          batteryHealth: (data.batteryHealth as number) ?? null,
          sellPriceAUD: (data.sellPriceAUD as number) ?? 0,
          sellPriceNZD: (data.sellPriceNZD as number) ?? null,
          images: (data.images as string[]) ?? [],
        };
      })
      .filter(Boolean);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No products found for this model" },
        { status: 404 }
      );
    }

    // Sort by storage then price
    items.sort((a, b) => {
      const storageCompare = (a!.storage).localeCompare(b!.storage);
      if (storageCompare !== 0) return storageCompare;
      return a!.sellPriceAUD - b!.sellPriceAUD;
    });

    const response = NextResponse.json({
      make,
      model,
      heroImage,
      items,
    });

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=120"
    );
    return response;
  } catch (error) {
    console.error("Error fetching products by model:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
