import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/shop/products/[id] — Public product detail
// Returns 404 if item is not listed or status is not "listed"
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doc = await adminDb.collection("inventory").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    // Only show listed items with "listed" status
    if (!data.listed || data.status !== "listed") {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Fetch device info
    let device: { make: string; model: string; storage: string } | null = null;
    if (data.deviceRef) {
      const deviceDoc = await adminDb
        .collection("devices")
        .doc(data.deviceRef as string)
        .get();
      if (deviceDoc.exists) {
        const d = deviceDoc.data()!;
        device = {
          make: (d.make as string) ?? "",
          model: (d.model as string) ?? "",
          storage: (d.storage as string) ?? "",
        };
      }
    }

    const response = NextResponse.json({
      id: doc.id,
      make: device?.make ?? "",
      model: device?.model ?? "",
      storage: device?.storage ?? "",
      category: data.category ?? "Phone",
      cosmeticGrade: data.cosmeticGrade ?? "",
      batteryHealth: data.batteryHealth ?? null,
      sellPriceAUD: data.sellPriceAUD ?? 0,
      sellPriceNZD: data.sellPriceNZD ?? null,
      images: (data.images as string[]) ?? [],
      spinVideo: data.spinVideo ?? null,
      notes: data.notes ?? "",
    });

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=120"
    );
    return response;
  } catch (error) {
    console.error("Error fetching product detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
