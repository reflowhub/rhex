import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// GET /api/admin/inventory — List inventory items with optional filters
// Query params:
//   ?status=    — filter by inventory status
//   ?category=  — filter by device category
//   ?search=    — search by device name or serial
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status")?.toLowerCase().trim() ?? "";
    const categoryFilter = searchParams.get("category")?.trim() ?? "";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";

    // Build Firestore query
    let query: FirebaseFirestore.Query = adminDb.collection("inventory");

    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }
    if (categoryFilter) {
      query = query.where("category", "==", categoryFilter);
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    // Collect unique deviceRefs for batch lookup
    const deviceIdSet = new Set<string>();
    const inventoryDocs: { id: string; data: Record<string, unknown> }[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      inventoryDocs.push({ id: doc.id, data });
      if (data.deviceRef && typeof data.deviceRef === "string") {
        deviceIdSet.add(data.deviceRef);
      }
    });

    // Batch-fetch device documents
    const deviceMap = new Map<string, Record<string, unknown>>();
    const deviceIds = Array.from(deviceIdSet);

    if (deviceIds.length > 0) {
      const deviceRefs = deviceIds.map((id) =>
        adminDb.collection("devices").doc(id)
      );
      const deviceDocs = await adminDb.getAll(...deviceRefs);
      deviceDocs.forEach((doc) => {
        if (doc.exists) {
          deviceMap.set(doc.id, doc.data() as Record<string, unknown>);
        }
      });
    }

    // Build response array with device info joined in
    let items: Record<string, unknown>[] = inventoryDocs.map(({ id, data }) => {
      const device = deviceMap.get(data.deviceRef as string);
      return {
        id,
        inventoryId: data.inventoryId,
        deviceRef: data.deviceRef,
        deviceMake: device?.make ?? "",
        deviceModel: device?.model ?? "",
        deviceStorage: device?.storage ?? "",
        category: data.category,
        serial: data.serial,
        sourceType: data.sourceType,
        cosmeticGrade: data.cosmeticGrade,
        costNZD: data.costNZD ?? null,
        costAUD: data.costAUD ?? null,
        sourceName: data.sourceName ?? null,
        sellPriceAUD: data.sellPriceAUD ?? 0,
        sellPriceNZD: data.sellPriceNZD ?? null,
        status: data.status,
        listed: data.listed ?? false,
        location: data.location ?? null,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
      };
    });

    // Apply in-memory search filter across device name + serial
    if (search) {
      items = items.filter((item) => {
        const make = String(item.deviceMake ?? "").toLowerCase();
        const model = String(item.deviceModel ?? "").toLowerCase();
        const storage = String(item.deviceStorage ?? "").toLowerCase();
        const serial = String(item.serial ?? "").toLowerCase();
        const combined = `${make} ${model} ${storage} ${serial}`;
        const searchWords = search.split(/\s+/).filter(Boolean);
        return searchWords.every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/inventory — Create a new inventory item
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { deviceRef, category, serial, sourceType, cosmeticGrade, costNZD, costAUD, sellPriceAUD } = body;

    // Validate required fields — cost can be NZD or AUD
    const hasCost = costNZD != null || costAUD != null;
    if (!deviceRef || !serial || !sourceType || !cosmeticGrade || !hasCost || sellPriceAUD == null) {
      return NextResponse.json(
        { error: "deviceRef, serial, sourceType, cosmeticGrade, cost (NZD or AUD), and sellPriceAUD are required" },
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

    // Auto-assign next inventoryId using a Firestore transaction
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

    const inventoryData: Record<string, unknown> = {
      inventoryId: inventoryId!,
      deviceRef,
      category: category || "Phone",
      serial,
      sourceType,
      sourceQuoteId: body.sourceQuoteId ?? null,
      acquiredAt: admin.firestore.FieldValue.serverTimestamp(),
      costNZD: costNZD ?? null,
      costAUD: costAUD ?? null,
      cosmeticGrade,
      batteryHealth: body.batteryHealth ?? null,
      notes: body.notes ?? "",
      sellPriceAUD,
      sellPriceNZD: body.sellPriceNZD ?? null,
      status: "received",
      listed: false,
      images: [],
      spinVideo: null,
      location: body.location ?? null,
      sourceName: body.sourceName ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection("inventory").add(inventoryData);

    return NextResponse.json(
      { id: docRef.id, ...inventoryData },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating inventory item:", error);
    return NextResponse.json(
      { error: "Failed to create inventory item" },
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
