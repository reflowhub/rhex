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
// GET /api/admin/customers — List customers with optional filters
// Query params:
//   ?type=individual|business  — filter by customer type
//   ?search=                   — search by name, email, or business name
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type")?.toLowerCase().trim() ?? "";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";

    let query: FirebaseFirestore.Query = adminDb.collection("customers");

    if (typeFilter === "individual" || typeFilter === "business") {
      query = query.where("type", "==", typeFilter);
    }

    query = query.orderBy("updatedAt", "desc");

    const snapshot = await query.get();

    let customers = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        businessName: data.businessName ?? null,
        totalQuotes: data.totalQuotes ?? 0,
        totalValueNZD: data.totalValueNZD ?? 0,
        lastActivityAt: data.lastActivityAt ?? null,
        createdAt: serializeTimestamp(data.createdAt),
      };
    });

    // In-memory search filter
    if (search) {
      customers = customers.filter((c) => {
        const combined = `${c.name ?? ""} ${c.email ?? ""} ${c.businessName ?? ""}`.toLowerCase();
        const searchWords = search.split(/\s+/).filter(Boolean);
        return searchWords.every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/customers — Manually create a customer
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { type, name, email, phone, businessName } = body;

    if (!type || !name || !email) {
      return NextResponse.json(
        { error: "type, name, and email are required" },
        { status: 400 }
      );
    }

    if (type !== "individual" && type !== "business") {
      return NextResponse.json(
        { error: "type must be 'individual' or 'business'" },
        { status: 400 }
      );
    }

    if (type === "business" && !businessName) {
      return NextResponse.json(
        { error: "businessName is required for business customers" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for duplicate email
    const existing = await adminDb
      .collection("customers")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        {
          error: "A customer with this email already exists",
          existingId: existing.docs[0].id,
        },
        { status: 409 }
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const customerData = {
      type,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      businessName: type === "business" ? businessName.trim() : null,
      shippingAddress: null,
      paymentMethod: null,
      payIdPhone: null,
      bankBSB: null,
      bankAccountNumber: null,
      bankAccountName: null,
      quoteIds: [],
      bulkQuoteIds: [],
      totalQuotes: 0,
      totalValueNZD: 0,
      lastActivityAt: null,
      notes: [],
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb.collection("customers").add(customerData);

    return NextResponse.json(
      { id: ref.id, ...customerData, createdAt: null, updatedAt: null },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
