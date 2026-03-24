import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// POST /api/cron/cleanup-reservations — Release stale reserved inventory
//
// Finds inventory items that have been "reserved" for longer than the TTL
// (30 minutes) and re-lists them. Associated pending orders are marked as
// "expired". Called by Vercel Cron every 10 minutes.
//
// Auth: Bearer token matching CRON_SECRET env var.
// ---------------------------------------------------------------------------

const RESERVATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reservedSnap = await adminDb
    .collection("inventory")
    .where("status", "==", "reserved")
    .get();

  if (reservedSnap.empty) {
    return NextResponse.json({ cleaned: 0, details: [] });
  }

  const now = Date.now();
  const staleItems: { id: string; reservedAt: Date }[] = [];

  for (const doc of reservedSnap.docs) {
    const data = doc.data();
    // Use reservedAt if available, fall back to updatedAt for pre-migration items
    const ts = data.reservedAt ?? data.updatedAt;
    if (!ts) continue;

    const reservedTime: Date = ts.toDate ? ts.toDate() : new Date(ts);
    if (now - reservedTime.getTime() > RESERVATION_TTL_MS) {
      staleItems.push({ id: doc.id, reservedAt: reservedTime });
    }
  }

  if (staleItems.length === 0) {
    return NextResponse.json({ cleaned: 0, details: [] });
  }

  // Find associated pending orders
  const pendingOrdersSnap = await adminDb
    .collection("orders")
    .where("status", "==", "pending")
    .get();

  const inventoryToOrder = new Map<string, string>();
  for (const orderDoc of pendingOrdersSnap.docs) {
    const items =
      (orderDoc.data().items as { inventoryId: string }[]) ?? [];
    for (const item of items) {
      inventoryToOrder.set(item.inventoryId, orderDoc.id);
    }
  }

  // Batch cleanup
  const batch = adminDb.batch();
  const expiredOrderIds = new Set<string>();
  const details: { inventoryId: string; orderId: string | null; ageMin: number }[] = [];

  for (const staleItem of staleItems) {
    const orderId = inventoryToOrder.get(staleItem.id) ?? null;

    batch.update(adminDb.collection("inventory").doc(staleItem.id), {
      status: "listed",
      listed: true,
      reservedAt: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (orderId && !expiredOrderIds.has(orderId)) {
      batch.update(adminDb.collection("orders").doc(orderId), {
        status: "expired",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      expiredOrderIds.add(orderId);
    }

    details.push({
      inventoryId: staleItem.id,
      orderId,
      ageMin: Math.round((now - staleItem.reservedAt.getTime()) / 60000),
    });
  }

  await batch.commit();

  return NextResponse.json({
    cleaned: staleItems.length,
    expiredOrders: expiredOrderIds.size,
    details,
  });
}
