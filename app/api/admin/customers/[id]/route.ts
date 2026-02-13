import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

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

// ---------------------------------------------------------------------------
// GET /api/admin/customers/[id] — Customer detail with linked quotes
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { id } = await params;
    const doc = await adminDb.collection("customers").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    // Batch-fetch linked individual quotes
    const quoteIds: string[] = data.quoteIds ?? [];
    const quotes: Record<string, unknown>[] = [];

    if (quoteIds.length > 0) {
      const quoteRefs = quoteIds.map((qid) =>
        adminDb.collection("quotes").doc(qid)
      );
      const quoteDocs = await adminDb.getAll(...quoteRefs);

      // Collect device IDs for batch lookup
      const deviceIdSet = new Set<string>();
      quoteDocs.forEach((qDoc) => {
        if (qDoc.exists) {
          const qData = qDoc.data()!;
          if (qData.deviceId) deviceIdSet.add(qData.deviceId as string);
        }
      });

      const deviceMap = new Map<string, Record<string, unknown>>();
      const deviceIds = Array.from(deviceIdSet);
      if (deviceIds.length > 0) {
        const deviceRefs = deviceIds.map((did) =>
          adminDb.collection("devices").doc(did)
        );
        const deviceDocs = await adminDb.getAll(...deviceRefs);
        deviceDocs.forEach((dDoc) => {
          if (dDoc.exists) {
            deviceMap.set(dDoc.id, dDoc.data() as Record<string, unknown>);
          }
        });
      }

      quoteDocs.forEach((qDoc) => {
        if (qDoc.exists) {
          const qData = qDoc.data()!;
          const device = deviceMap.get(qData.deviceId as string);
          quotes.push({
            id: qDoc.id,
            deviceMake: device?.make ?? "",
            deviceModel: device?.model ?? "",
            deviceStorage: device?.storage ?? "",
            grade: qData.grade,
            quotePriceNZD: qData.quotePriceNZD,
            status: qData.status,
            createdAt: serializeTimestamp(qData.createdAt),
          });
        }
      });
    }

    // Batch-fetch linked bulk quotes
    const bulkQuoteIds: string[] = data.bulkQuoteIds ?? [];
    const bulkQuotes: Record<string, unknown>[] = [];

    if (bulkQuoteIds.length > 0) {
      const bulkRefs = bulkQuoteIds.map((bqid) =>
        adminDb.collection("bulkQuotes").doc(bqid)
      );
      const bulkDocs = await adminDb.getAll(...bulkRefs);

      bulkDocs.forEach((bDoc) => {
        if (bDoc.exists) {
          const bData = bDoc.data()!;
          bulkQuotes.push({
            id: bDoc.id,
            businessName: bData.businessName ?? "",
            totalDevices: bData.totalDevices ?? 0,
            totalIndicativeNZD: bData.totalIndicativeNZD ?? 0,
            status: bData.status,
            createdAt: serializeTimestamp(bData.createdAt),
          });
        }
      });
    }

    // Batch-fetch linked orders
    const orderIds: string[] = data.orderIds ?? [];
    const orders: Record<string, unknown>[] = [];

    if (orderIds.length > 0) {
      const orderRefs = orderIds.map((oid) =>
        adminDb.collection("orders").doc(oid)
      );
      const orderDocs = await adminDb.getAll(...orderRefs);

      orderDocs.forEach((oDoc) => {
        if (oDoc.exists) {
          const oData = oDoc.data()!;
          const items = (oData.items as { description: string }[]) ?? [];
          orders.push({
            id: oDoc.id,
            orderNumber: oData.orderNumber,
            itemCount: items.length,
            totalAUD: oData.totalAUD ?? 0,
            status: oData.status,
            createdAt: serializeTimestamp(oData.createdAt),
          });
        }
      });
    }

    return NextResponse.json({
      id: doc.id,
      type: data.type,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      businessName: data.businessName ?? null,
      shippingAddress: data.shippingAddress ?? null,
      paymentMethod: data.paymentMethod ?? null,
      payIdPhone: data.payIdPhone ?? null,
      bankBSB: data.bankBSB ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankAccountName: data.bankAccountName ?? null,
      totalQuotes: data.totalQuotes ?? 0,
      totalValueNZD: data.totalValueNZD ?? 0,
      totalOrders: data.totalOrders ?? 0,
      totalOrderValueAUD: data.totalOrderValueAUD ?? 0,
      lastActivityAt: data.lastActivityAt ?? null,
      notes: data.notes ?? [],
      quotes,
      bulkQuotes,
      orders,
      createdAt: serializeTimestamp(data.createdAt),
      updatedAt: serializeTimestamp(data.updatedAt),
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/customers/[id] — Update customer contact info
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { id } = await params;
    const body = await request.json();

    const doc = await adminDb.collection("customers").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const allowedFields = [
      "name",
      "email",
      "phone",
      "businessName",
      "shippingAddress",
      "paymentMethod",
      "payIdPhone",
      "bankBSB",
      "bankAccountNumber",
      "bankAccountName",
    ];

    const updateData: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    for (const field of allowedFields) {
      if (field in body) {
        if (field === "email") {
          const newEmail = (body.email as string).toLowerCase().trim();
          // Check for duplicate if email is changing
          if (newEmail !== doc.data()!.email) {
            const existing = await adminDb
              .collection("customers")
              .where("email", "==", newEmail)
              .limit(1)
              .get();
            if (!existing.empty) {
              return NextResponse.json(
                { error: "A customer with this email already exists" },
                { status: 409 }
              );
            }
          }
          updateData.email = newEmail;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    await adminDb.collection("customers").doc(id).update(updateData);

    // Sync denormalized fields back to linked quote documents
    const customerData = doc.data()!;
    const quoteFields: Record<string, string> = {
      name: "customerName",
      email: "customerEmail",
      phone: "customerPhone",
      paymentMethod: "paymentMethod",
      payIdPhone: "payIdPhone",
      bankBSB: "bankBSB",
      bankAccountNumber: "bankAccountNumber",
      bankAccountName: "bankAccountName",
      shippingAddress: "shippingAddress",
    };

    const quoteUpdate: Record<string, unknown> = {};
    for (const [customerField, quoteField] of Object.entries(quoteFields)) {
      if (customerField in updateData && updateData[customerField] !== customerData[customerField]) {
        quoteUpdate[quoteField] = updateData[customerField];
      }
    }

    if (Object.keys(quoteUpdate).length > 0) {
      const quoteIds: string[] = customerData.quoteIds ?? [];
      if (quoteIds.length > 0) {
        const batch = adminDb.batch();
        for (const qid of quoteIds) {
          batch.update(adminDb.collection("quotes").doc(qid), quoteUpdate);
        }
        await batch.commit();
      }
    }

    return NextResponse.json({ id, ...updateData, updatedAt: null });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}
