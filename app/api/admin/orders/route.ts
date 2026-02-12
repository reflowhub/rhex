import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// GET /api/admin/orders — List orders with optional filters
// Query params:
//   ?status=   — filter by order status
//   ?search=   — search by order number, customer name, or email
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status")?.toLowerCase().trim() ?? "";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";

    // Build Firestore query
    let query: FirebaseFirestore.Query = adminDb.collection("orders");

    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    let orders = snapshot.docs.map((doc) => {
      const data = doc.data();
      const items = (data.items as { inventoryId: string; description: string; priceNZD: number }[]) ?? [];
      return {
        id: doc.id,
        orderNumber: data.orderNumber,
        customerName: data.customerName ?? "",
        customerEmail: data.customerEmail ?? "",
        itemCount: items.length,
        totalNZD: data.totalNZD ?? 0,
        displayCurrency: data.displayCurrency ?? "NZD",
        status: data.status,
        paymentStatus: data.paymentStatus ?? "pending",
        createdAt: serializeTimestamp(data.createdAt),
      };
    });

    // In-memory search across order number, name, email
    if (search) {
      orders = orders.filter((o) => {
        const combined = `${o.orderNumber} ${o.customerName} ${o.customerEmail}`.toLowerCase();
        const searchWords = search.split(/\s+/).filter(Boolean);
        return searchWords.every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
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
