import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// POST /api/admin/inventory/receive — Receive a device from a quote into
// inventory. Auto-fills fields from the source quote.
// ---------------------------------------------------------------------------

const RECEIVABLE_STATUSES = ["received", "inspected", "paid"];

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { quoteType, quoteId, lineId, serial, cosmeticGrade, sellPriceNZD } = body;

    // Validate required fields
    if (!quoteType || !quoteId || !serial || !cosmeticGrade || sellPriceNZD == null) {
      return NextResponse.json(
        { error: "quoteType, quoteId, serial, cosmeticGrade, and sellPriceNZD are required" },
        { status: 400 }
      );
    }

    if (!["individual", "bulk"].includes(quoteType)) {
      return NextResponse.json(
        { error: "quoteType must be 'individual' or 'bulk'" },
        { status: 400 }
      );
    }

    // Check for duplicate serial
    const existing = await adminDb
      .collection("inventory")
      .where("serial", "==", serial)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: `An inventory item with serial "${serial}" already exists` },
        { status: 409 }
      );
    }

    let deviceRef: string;
    let category: string;
    let costNZD: number;
    let sourceType: "trade-in" | "bulk";

    if (quoteType === "individual") {
      // -----------------------------------------------------------------------
      // Individual quote
      // -----------------------------------------------------------------------
      const quoteDoc = await adminDb.collection("quotes").doc(quoteId).get();
      if (!quoteDoc.exists) {
        return NextResponse.json(
          { error: "Quote not found" },
          { status: 404 }
        );
      }

      const quoteData = quoteDoc.data()!;

      if (!RECEIVABLE_STATUSES.includes(quoteData.status as string)) {
        return NextResponse.json(
          { error: `Quote must be at 'received' status or later (current: ${quoteData.status})` },
          { status: 400 }
        );
      }

      deviceRef = quoteData.deviceId as string;
      costNZD = (quoteData.revisedPriceNZD as number) ?? (quoteData.quotePriceNZD as number);
      sourceType = "trade-in";

      // Look up device for category
      const deviceDoc = await adminDb.collection("devices").doc(deviceRef).get();
      category = deviceDoc.exists
        ? ((deviceDoc.data()?.category as string) ?? "Phone")
        : "Phone";
    } else {
      // -----------------------------------------------------------------------
      // Bulk quote
      // -----------------------------------------------------------------------
      if (!lineId) {
        return NextResponse.json(
          { error: "lineId is required for bulk quotes" },
          { status: 400 }
        );
      }

      const bulkDoc = await adminDb.collection("bulkQuotes").doc(quoteId).get();
      if (!bulkDoc.exists) {
        return NextResponse.json(
          { error: "Bulk quote not found" },
          { status: 404 }
        );
      }

      const bulkData = bulkDoc.data()!;

      if (!RECEIVABLE_STATUSES.includes(bulkData.status as string)) {
        return NextResponse.json(
          { error: `Bulk quote must be at 'received' status or later (current: ${bulkData.status})` },
          { status: 400 }
        );
      }

      const lineDoc = await adminDb
        .collection("bulkQuotes")
        .doc(quoteId)
        .collection("devices")
        .doc(lineId)
        .get();

      if (!lineDoc.exists) {
        return NextResponse.json(
          { error: "Line item not found" },
          { status: 404 }
        );
      }

      const lineData = lineDoc.data()!;
      deviceRef = lineData.deviceId as string;

      // Per-unit cost: use actual price if inspected, else indicative price / quantity
      const quantity = (lineData.quantity as number) || 1;
      if (lineData.actualPriceNZD != null) {
        costNZD = (lineData.actualPriceNZD as number) / quantity;
      } else {
        costNZD = ((lineData.indicativePriceNZD as number) ?? 0) / quantity;
      }

      sourceType = "bulk";

      // Look up device for category
      const deviceDoc = await adminDb.collection("devices").doc(deviceRef).get();
      category = deviceDoc.exists
        ? ((deviceDoc.data()?.category as string) ?? "Phone")
        : "Phone";
    }

    // Auto-assign next inventoryId
    const counterRef = adminDb.doc("counters/inventory");
    let inventoryId: number;

    await adminDb.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      if (!counterDoc.exists) {
        inventoryId = 1;
        transaction.set(counterRef, { nextId: 2 });
      } else {
        inventoryId = counterDoc.data()?.nextId ?? 1;
        transaction.update(counterRef, { nextId: inventoryId + 1 });
      }
    });

    const inventoryData = {
      inventoryId: inventoryId!,
      deviceRef,
      category,
      serial,
      sourceType,
      sourceQuoteId: quoteId,
      acquiredAt: admin.firestore.FieldValue.serverTimestamp(),
      costNZD,
      cosmeticGrade,
      batteryHealth: body.batteryHealth ?? null,
      notes: body.notes ?? "",
      sellPriceNZD,
      sellPriceAUD: null,
      status: "received",
      listed: false,
      images: [],
      spinVideo: null,
      location: body.location ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection("inventory").add(inventoryData);

    return NextResponse.json(
      { id: docRef.id, inventoryId: inventoryId! },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error receiving into inventory:", error);
    return NextResponse.json(
      { error: "Failed to receive into inventory" },
      { status: 500 }
    );
  }
}
