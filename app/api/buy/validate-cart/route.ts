import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// POST /api/buy/validate-cart — Bulk availability check
//
// Body: { items: [{ inventoryId: string }] }
// Returns: { available: string[], unavailable: string[] }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { items } = (await request.json()) as {
      items: { inventoryId: string }[];
    };

    if (!items?.length) {
      return NextResponse.json({ available: [], unavailable: [] });
    }

    const refs = items.map((item) =>
      adminDb.collection("inventory").doc(item.inventoryId)
    );
    const docs = await adminDb.getAll(...refs);

    const available: string[] = [];
    const unavailable: string[] = [];

    for (const doc of docs) {
      if (!doc.exists) {
        unavailable.push(doc.id);
        continue;
      }
      const data = doc.data()!;
      if (data.status === "listed" && data.listed === true) {
        available.push(doc.id);
      } else {
        unavailable.push(doc.id);
      }
    }

    return NextResponse.json({ available, unavailable });
  } catch (error) {
    console.error("Error validating cart:", error);
    return NextResponse.json(
      { error: "Failed to validate cart" },
      { status: 500 }
    );
  }
}
