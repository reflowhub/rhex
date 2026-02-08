import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/admin/pricing/[id] — Get a price list with all prices + device info
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const priceListRef = adminDb.collection("priceLists").doc(id);
    const priceListDoc = await priceListRef.get();

    if (!priceListDoc.exists) {
      return NextResponse.json(
        { error: "Price list not found" },
        { status: 404 }
      );
    }

    const priceListData = priceListDoc.data()!;
    const priceList = {
      id: priceListDoc.id,
      name: priceListData.name,
      effectiveDate:
        priceListData.effectiveDate?.toDate?.()?.toISOString() ?? null,
      currency: priceListData.currency,
      deviceCount: priceListData.deviceCount,
      createdAt: priceListData.createdAt?.toDate?.()?.toISOString() ?? null,
    };

    // Fetch all prices in the subcollection
    const pricesSnapshot = await priceListRef.collection("prices").get();

    // Collect the device doc IDs we need to look up
    const deviceDocIds = pricesSnapshot.docs.map((doc) => doc.id);

    // Batch-fetch device docs (Firestore getAll supports up to 100 at a time,
    // but admin SDK getAll has no hard limit — it handles batching internally)
    const deviceRefs = deviceDocIds.map((docId) =>
      adminDb.collection("devices").doc(docId)
    );

    let deviceDocs: FirebaseFirestore.DocumentSnapshot[] = [];
    if (deviceRefs.length > 0) {
      deviceDocs = await adminDb.getAll(...deviceRefs);
    }

    // Build a map of device doc ID -> device data
    const deviceMap = new Map<string, Record<string, unknown>>();
    deviceDocs.forEach((doc) => {
      if (doc.exists) {
        deviceMap.set(doc.id, doc.data() as Record<string, unknown>);
      }
    });

    // Combine prices with device info
    const prices: Record<string, unknown>[] = pricesSnapshot.docs.map((doc) => {
      const priceData = doc.data();
      const device = deviceMap.get(doc.id);
      return {
        deviceId: doc.id,
        make: device?.make ?? "",
        model: device?.model ?? "",
        storage: device?.storage ?? "",
        gradeA: priceData.gradeA,
        gradeB: priceData.gradeB,
        gradeC: priceData.gradeC,
        gradeD: priceData.gradeD,
        gradeE: priceData.gradeE,
      };
    });

    // Sort by make, model, storage
    prices.sort((a, b) => {
      const makeA = String(a.make ?? "").toLowerCase();
      const makeB = String(b.make ?? "").toLowerCase();
      if (makeA !== makeB) return makeA.localeCompare(makeB);

      const modelA = String(a.model ?? "").toLowerCase();
      const modelB = String(b.model ?? "").toLowerCase();
      if (modelA !== modelB) return modelA.localeCompare(modelB);

      const storageA = String(a.storage ?? "").toLowerCase();
      const storageB = String(b.storage ?? "").toLowerCase();
      return storageA.localeCompare(storageB);
    });

    return NextResponse.json({ priceList, prices });
  } catch (error) {
    console.error("Error fetching price list details:", error);
    return NextResponse.json(
      { error: "Failed to fetch price list details" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/pricing/[id] — Delete a price list and all its prices
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const priceListRef = adminDb.collection("priceLists").doc(id);
    const priceListDoc = await priceListRef.get();

    if (!priceListDoc.exists) {
      return NextResponse.json(
        { error: "Price list not found" },
        { status: 404 }
      );
    }

    // Delete all documents in the prices subcollection in batches
    const pricesSnapshot = await priceListRef.collection("prices").get();
    const BATCH_SIZE = 200;
    const priceDocs = pricesSnapshot.docs;

    for (let i = 0; i < priceDocs.length; i += BATCH_SIZE) {
      const chunk = priceDocs.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Delete the price list document itself
    await priceListRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting price list:", error);
    return NextResponse.json(
      { error: "Failed to delete price list" },
      { status: 500 }
    );
  }
}
