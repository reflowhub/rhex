import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/shop/orders/[id] — Public order lookup
// Requires ?email= query param for verification (must match customerEmail)
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.toLowerCase().trim();

    const doc = await adminDb.collection("orders").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    // Verify email matches (security check)
    if (email && data.customerEmail?.toLowerCase() !== email) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: doc.id,
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      status: data.status,
      paymentStatus: data.paymentStatus,
      items: data.items,
      subtotalNZD: data.subtotalNZD,
      shippingNZD: data.shippingNZD,
      totalNZD: data.totalNZD,
      displayCurrency: data.displayCurrency,
      shippingAddress: data.shippingAddress,
      createdAt: serializeTimestamp(data.createdAt),
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
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
