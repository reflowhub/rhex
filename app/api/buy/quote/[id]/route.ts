import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// GET /api/buy/quote/[id]
// Returns non-sensitive fields of a trade-in quote for validation/linking.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Quote ID is required" },
        { status: 400 }
      );
    }

    const doc = await adminDb.collection("quotes").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    const expiresAt = data.expiresAt?.toDate?.()
      ? data.expiresAt.toDate().toISOString()
      : null;

    return NextResponse.json({
      id: doc.id,
      status: data.status,
      deviceId: data.deviceId,
      grade: data.grade,
      quotePriceDisplay: data.quotePriceDisplay,
      displayCurrency: data.displayCurrency,
      expiresAt,
    });
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
