import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// GET /api/admin/inventory/[id] — Get full inventory item detail
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const doc = await adminDb.collection("inventory").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Inventory item not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    // Fetch associated device
    let device: { id: string; make: string; model: string; storage: string } | null = null;
    if (data.deviceRef && typeof data.deviceRef === "string") {
      const deviceDoc = await adminDb.collection("devices").doc(data.deviceRef).get();
      if (deviceDoc.exists) {
        const d = deviceDoc.data()!;
        device = {
          id: deviceDoc.id,
          make: (d.make as string) ?? "",
          model: (d.model as string) ?? "",
          storage: (d.storage as string) ?? "",
        };
      }
    }

    // Fetch source quote if linked
    let sourceQuote: Record<string, unknown> | null = null;
    if (data.sourceQuoteId && typeof data.sourceQuoteId === "string") {
      const collection = data.sourceType === "bulk" ? "bulkQuotes" : "quotes";
      const quoteDoc = await adminDb.collection(collection).doc(data.sourceQuoteId).get();
      if (quoteDoc.exists) {
        const q = quoteDoc.data()!;
        sourceQuote = {
          id: quoteDoc.id,
          customerName: q.customerName ?? q.contactName ?? null,
          status: q.status,
          grade: q.grade ?? q.assumedGrade ?? null,
          quotePriceNZD: q.quotePriceNZD ?? q.totalIndicativeNZD ?? null,
        };
      }
    }

    return NextResponse.json({
      id: doc.id,
      inventoryId: data.inventoryId,
      deviceRef: data.deviceRef,
      device,
      category: data.category,
      serial: data.serial,
      sourceType: data.sourceType,
      sourceQuoteId: data.sourceQuoteId ?? null,
      sourceQuote,
      acquiredAt: serializeTimestamp(data.acquiredAt),
      costNZD: data.costNZD,
      cosmeticGrade: data.cosmeticGrade,
      batteryHealth: data.batteryHealth ?? null,
      notes: data.notes ?? "",
      sellPriceAUD: data.sellPriceAUD ?? data.sellPriceNZD ?? 0,
      sellPriceNZD: data.sellPriceNZD ?? null,
      status: data.status,
      listed: data.listed ?? false,
      images: data.images ?? [],
      spinVideo: data.spinVideo ?? null,
      location: data.location ?? null,
      createdAt: serializeTimestamp(data.createdAt),
      updatedAt: serializeTimestamp(data.updatedAt),
    });
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory item" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/inventory/[id] — Update inventory item fields
// ---------------------------------------------------------------------------

const ALLOWED_FIELDS = [
  "status",
  "cosmeticGrade",
  "batteryHealth",
  "notes",
  "sellPriceNZD",
  "sellPriceAUD",
  "listed",
  "location",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const docRef = adminDb.collection("inventory").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Inventory item not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build update payload from allowed fields only
    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await docRef.update(updateData);

    // Return updated doc
    const updated = await docRef.get();
    const data = updated.data()!;

    return NextResponse.json({
      id: updated.id,
      inventoryId: data.inventoryId,
      status: data.status,
      cosmeticGrade: data.cosmeticGrade,
      sellPriceAUD: data.sellPriceAUD ?? data.sellPriceNZD ?? 0,
      sellPriceNZD: data.sellPriceNZD ?? null,
      listed: data.listed ?? false,
      location: data.location ?? null,
      updatedAt: serializeTimestamp(data.updatedAt),
    });
  } catch (error) {
    console.error("Error updating inventory item:", error);
    return NextResponse.json(
      { error: "Failed to update inventory item" },
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
