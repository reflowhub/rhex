import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/shop/upsells — Public: active upsell products, optionally by category
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.trim();

  const snapshot = await adminDb
    .collection("upsellProducts")
    .where("active", "==", true)
    .get();

  let items = snapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name as string,
    description: doc.data().description as string,
    priceAUD: doc.data().priceAUD as number,
    image: doc.data().image as string | null,
    compatibleCategories: doc.data().compatibleCategories as string[],
  }));

  if (category) {
    items = items.filter((item) =>
      item.compatibleCategories?.includes(category)
    );
  }

  const response = NextResponse.json(items);
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );

  return response;
}
