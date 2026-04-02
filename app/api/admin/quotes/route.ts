import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { readGrades } from "@/lib/grades";
import { getActivePriceList, getCategoryGrades } from "@/lib/categories";
import { getTodayFXRate, convertPrice } from "@/lib/fx";

// ---------------------------------------------------------------------------
// GET /api/admin/quotes — List all quotes with optional filters
// Query params:
//   ?status=   — filter by quote status
//   ?search=   — search by customer name or email
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status")?.toLowerCase().trim() ?? "";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";

    // Build Firestore query
    let query: FirebaseFirestore.Query = adminDb.collection("quotes");

    // Apply status filter at the query level if provided
    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }

    // Always order by createdAt descending (most recent first)
    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    // Collect unique deviceIds for batch lookup
    const deviceIdSet = new Set<string>();
    const quoteDocs: { id: string; data: Record<string, unknown> }[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      quoteDocs.push({ id: doc.id, data });
      if (data.deviceId && typeof data.deviceId === "string") {
        deviceIdSet.add(data.deviceId);
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

    // Batch-fetch partner documents
    const partnerIdSet = new Set<string>();
    quoteDocs.forEach(({ data }) => {
      if (data.partnerId && typeof data.partnerId === "string") {
        partnerIdSet.add(data.partnerId);
      }
    });

    const partnerMap = new Map<string, string>();
    const partnerIds = Array.from(partnerIdSet);
    if (partnerIds.length > 0) {
      const partnerRefs = partnerIds.map((pid) =>
        adminDb.collection("partners").doc(pid)
      );
      const partnerDocs = await adminDb.getAll(...partnerRefs);
      partnerDocs.forEach((doc) => {
        if (doc.exists) {
          const d = doc.data() as Record<string, unknown>;
          partnerMap.set(doc.id, (d.name as string) ?? "");
        }
      });
    }

    // Build response array with device + partner info joined in
    let quotes: Record<string, unknown>[] = quoteDocs.map(({ id, data }) => {
      const device = deviceMap.get(data.deviceId as string);
      const partnerId = (data.partnerId as string) ?? null;
      return {
        id,
        deviceId: data.deviceId,
        deviceMake: device?.make ?? "",
        deviceModel: device?.model ?? "",
        deviceStorage: device?.storage ?? "",
        grade: data.grade,
        quotePriceNZD: data.quotePriceNZD,
        displayCurrency: data.displayCurrency,
        status: data.status,
        customerName: data.customerName ?? null,
        customerEmail: data.customerEmail ?? null,
        customerPhone: data.customerPhone ?? null,
        partnerId,
        partnerName: partnerId ? (partnerMap.get(partnerId) ?? null) : null,
        partnerMode: data.partnerMode ?? null,
        createdAt: serializeTimestamp(data.createdAt),
        expiresAt: serializeTimestamp(data.expiresAt),
        acceptedAt: serializeTimestamp(data.acceptedAt),
        imei: data.imei ?? null,
        inspectionGrade: data.inspectionGrade ?? null,
        revisedPriceNZD: data.revisedPriceNZD ?? null,
      };
    });

    // Apply in-memory search filter for customer name/email
    if (search) {
      quotes = quotes.filter((q) => {
        const name = String(q.customerName ?? "").toLowerCase();
        const email = String(q.customerEmail ?? "").toLowerCase();
        const combined = `${name} ${email}`;
        const searchWords = search.split(/\s+/).filter(Boolean);
        return searchWords.every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(quotes);
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/quotes — Create a new quote (admin-initiated)
// Body: { deviceId, grade, imei?, partnerId?, displayCurrency? }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { deviceId, grade, imei, partnerId, displayCurrency } = body;

    if (!deviceId || !grade) {
      return NextResponse.json(
        { error: "deviceId and grade are required" },
        { status: 400 }
      );
    }

    const normalizedGrade = grade.toUpperCase();

    // Look up device
    const deviceDoc = await adminDb.collection("devices").doc(deviceId).get();
    if (!deviceDoc.exists) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    const deviceData = deviceDoc.data()!;
    const category = (deviceData.category as string) ?? "Phone";

    // Validate grade against category grades
    const categoryGrades = await getCategoryGrades(category);
    const validKeys =
      categoryGrades.length > 0
        ? categoryGrades.map((g) => g.key)
        : ["A", "B", "C", "D", "E"];

    if (!validKeys.includes(normalizedGrade)) {
      return NextResponse.json(
        { error: `Invalid grade "${normalizedGrade}" for ${category}` },
        { status: 400 }
      );
    }

    // Look up price from active price list
    const priceListId = await getActivePriceList(category);
    if (!priceListId) {
      return NextResponse.json(
        { error: "No pricing available for this device category" },
        { status: 404 }
      );
    }

    const priceDoc = await adminDb
      .doc(`priceLists/${priceListId}/prices/${deviceId}`)
      .get();

    if (!priceDoc.exists) {
      return NextResponse.json(
        { error: "No pricing available for this device" },
        { status: 404 }
      );
    }

    const grades = readGrades(priceDoc.data()!);
    const quotePriceNZD = grades[normalizedGrade];

    if (quotePriceNZD === undefined || quotePriceNZD === null) {
      return NextResponse.json(
        { error: `No price available for grade ${normalizedGrade}` },
        { status: 404 }
      );
    }

    // Currency conversion
    const currency = displayCurrency === "AUD" ? "AUD" : "NZD";
    let fxRate = 1;
    let quotePriceDisplay = Number(quotePriceNZD);

    if (currency === "AUD") {
      const rates = await getTodayFXRate();
      fxRate = rates.NZD_AUD;
      quotePriceDisplay = convertPrice(Number(quotePriceNZD), "AUD", fxRate, 5);
    }

    // Calculate expiry (14 days from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Build quote document
    const quoteData: Record<string, unknown> = {
      deviceId,
      grade: normalizedGrade,
      imei: imei || null,
      quotePriceNZD: Number(quotePriceNZD),
      quotePriceDisplay,
      displayCurrency: currency,
      fxRate,
      status: "quoted",
      source: "admin",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    };

    if (partnerId && typeof partnerId === "string") {
      quoteData.partnerId = partnerId;
      quoteData.partnerMode = "B";
    }

    const quoteRef = await adminDb.collection("quotes").add(quoteData);

    return NextResponse.json(
      {
        id: quoteRef.id,
        ...quoteData,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating quote:", error);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  // Firestore Timestamp objects have a toDate() method
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate: () => Date };
    return ts.toDate().toISOString();
  }
  // Already a string or Date
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
