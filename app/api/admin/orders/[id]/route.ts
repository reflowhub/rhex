import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const VALID_CARRIERS = ["NZ Post", "CourierPost", "AusPost", "Other"];

// ---------------------------------------------------------------------------
// GET /api/admin/orders/[id] — Full order detail
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const doc = await adminDb.collection("orders").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    return NextResponse.json({
      id: doc.id,
      orderNumber: data.orderNumber,
      customerName: data.customerName ?? "",
      customerEmail: data.customerEmail ?? "",
      customerPhone: data.customerPhone ?? null,
      shippingAddress: data.shippingAddress ?? {},
      items: data.items ?? [],
      subtotalAUD: data.subtotalAUD ?? data.subtotalNZD ?? 0,
      shippingAUD: data.shippingAUD ?? data.shippingNZD ?? 0,
      totalAUD: data.totalAUD ?? data.totalNZD ?? 0,
      displayCurrency: data.displayCurrency ?? "AUD",
      stripePaymentIntentId: data.stripePaymentIntentId ?? null,
      stripeCheckoutSessionId: data.stripeCheckoutSessionId ?? null,
      paymentStatus: data.paymentStatus ?? "pending",
      status: data.status,
      trackingNumber: data.trackingNumber ?? null,
      trackingCarrier: data.trackingCarrier ?? null,
      shippedAt: serializeTimestamp(data.shippedAt),
      deliveredAt: serializeTimestamp(data.deliveredAt),
      cancelledAt: serializeTimestamp(data.cancelledAt),
      createdAt: serializeTimestamp(data.createdAt),
      updatedAt: serializeTimestamp(data.updatedAt),
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
// PATCH /api/admin/orders/[id] — Update order status + tracking info
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const orderRef = adminDb.collection("orders").doc(id);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const currentData = orderDoc.data()!;
    const currentStatus = currentData.status as string;
    const body = await request.json();
    const newStatus = body.status as string;

    if (!newStatus) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    // Reject updates on pending orders (payment not confirmed)
    if (currentStatus === "pending") {
      return NextResponse.json(
        { error: "Order is pending payment and cannot be updated" },
        { status: 400 }
      );
    }

    // Validate status transition
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed) {
      return NextResponse.json(
        { error: `Current status "${currentStatus}" is not recognized` },
        { status: 400 }
      );
    }

    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(", ") || "none"}`,
        },
        { status: 400 }
      );
    }

    // --- Handle cancellation with batch write (re-list inventory) -----------
    if (newStatus === "cancelled") {
      const batch = adminDb.batch();

      batch.update(orderRef, {
        status: "cancelled",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const orderItems = (currentData.items as { inventoryId: string }[]) ?? [];
      for (const item of orderItems) {
        const invRef = adminDb.collection("inventory").doc(item.inventoryId);
        batch.update(invRef, {
          status: "listed",
          listed: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      const updated = await orderRef.get();
      return NextResponse.json({
        id: updated.id,
        status: updated.data()!.status,
        cancelledAt: serializeTimestamp(updated.data()!.cancelledAt),
      });
    }

    // --- Handle non-cancellation status updates -----------------------------
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (newStatus === "shipped") {
      if (!body.trackingNumber || !body.trackingCarrier) {
        return NextResponse.json(
          { error: "trackingNumber and trackingCarrier are required for shipping" },
          { status: 400 }
        );
      }
      if (!VALID_CARRIERS.includes(body.trackingCarrier)) {
        return NextResponse.json(
          { error: `trackingCarrier must be one of: ${VALID_CARRIERS.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.trackingNumber = body.trackingNumber;
      updateData.trackingCarrier = body.trackingCarrier;
      updateData.shippedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    if (newStatus === "delivered") {
      updateData.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await orderRef.update(updateData);

    const updated = await orderRef.get();
    const updatedData = updated.data()!;

    return NextResponse.json({
      id: updated.id,
      status: updatedData.status,
      trackingNumber: updatedData.trackingNumber ?? null,
      trackingCarrier: updatedData.trackingCarrier ?? null,
      shippedAt: serializeTimestamp(updatedData.shippedAt),
      deliveredAt: serializeTimestamp(updatedData.deliveredAt),
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
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
