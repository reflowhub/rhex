import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/admin/partners — List all partners with optional filters
// Query params:
//   ?status=   — filter by partner status (active/inactive)
//   ?search=   — search by partner name or code
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status")?.toLowerCase().trim() ?? "";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";

    let query: FirebaseFirestore.Query = adminDb.collection("partners");

    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    let partners = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name ?? "",
        code: data.code ?? "",
        contactEmail: data.contactEmail ?? "",
        modes: data.modes ?? [],
        status: data.status ?? "inactive",
        commissionModel: data.commissionModel ?? null,
        commissionPercent: data.commissionPercent ?? null,
        commissionFlat: data.commissionFlat ?? null,
        commissionTiers: data.commissionTiers ?? null,
        payoutFrequency: data.payoutFrequency ?? "monthly",
        partnerRateDiscount: data.partnerRateDiscount ?? null,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
      };
    });

    if (search) {
      partners = partners.filter((p) => {
        const combined = `${p.name} ${p.code} ${p.contactEmail}`.toLowerCase();
        const searchWords = search.split(/\s+/).filter(Boolean);
        return searchWords.every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(partners);
  } catch (error) {
    console.error("Error fetching partners:", error);
    return NextResponse.json(
      { error: "Failed to fetch partners" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/partners — Create a new partner
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      code,
      contactEmail,
      password,
      modes,
      status,
      // Mode A fields
      commissionModel,
      commissionPercent,
      commissionFlat,
      commissionTiers,
      payoutFrequency,
      // Mode B fields
      partnerRateDiscount,
    } = body;

    // Validate required fields
    if (!name || !code || !contactEmail || !password || !modes || !Array.isArray(modes) || modes.length === 0) {
      return NextResponse.json(
        { error: "name, code, contactEmail, password, and at least one mode are required" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Validate code format (alphanumeric, uppercase)
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalizedCode.length < 3) {
      return NextResponse.json(
        { error: "Code must be at least 3 alphanumeric characters" },
        { status: 400 }
      );
    }

    // Check code uniqueness
    const existingPartner = await adminDb
      .collection("partners")
      .where("code", "==", normalizedCode)
      .limit(1)
      .get();

    if (!existingPartner.empty) {
      return NextResponse.json(
        { error: `Partner code "${normalizedCode}" is already in use` },
        { status: 409 }
      );
    }

    // Validate modes
    const validModes = ["A", "B"];
    const normalizedModes = modes.filter((m: string) => validModes.includes(m));
    if (normalizedModes.length === 0) {
      return NextResponse.json(
        { error: "At least one valid mode (A or B) is required" },
        { status: 400 }
      );
    }

    // Build partner document
    const partnerData: Record<string, unknown> = {
      name: name.trim(),
      code: normalizedCode,
      contactEmail: contactEmail.trim(),
      modes: normalizedModes,
      status: status === "active" ? "active" : "inactive",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Mode A fields
    if (normalizedModes.includes("A")) {
      partnerData.commissionModel = commissionModel || "percentage";
      partnerData.commissionPercent = commissionPercent ?? 5;
      partnerData.commissionFlat = commissionFlat ?? null;
      partnerData.commissionTiers = commissionTiers ?? null;
      partnerData.payoutFrequency = payoutFrequency || "monthly";
    } else {
      partnerData.commissionModel = null;
      partnerData.commissionPercent = null;
      partnerData.commissionFlat = null;
      partnerData.commissionTiers = null;
      partnerData.payoutFrequency = null;
    }

    // Mode B fields
    if (normalizedModes.includes("B")) {
      partnerData.partnerRateDiscount = partnerRateDiscount ?? 5;
    } else {
      partnerData.partnerRateDiscount = null;
    }

    // Create Firebase Auth user for partner login
    let authUser;
    try {
      authUser = await adminAuth.createUser({
        email: contactEmail.trim(),
        password,
        displayName: name.trim(),
      });
    } catch (authError: unknown) {
      const fbErr = authError as { code?: string; message?: string };
      if (fbErr.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 409 }
        );
      }
      console.error("Error creating auth user:", authError);
      return NextResponse.json(
        { error: "Failed to create login account" },
        { status: 500 }
      );
    }

    partnerData.authUid = authUser.uid;

    let docRef;
    try {
      docRef = await adminDb.collection("partners").add(partnerData);
    } catch (dbError) {
      // Clean up auth user if Firestore write fails
      await adminAuth.deleteUser(authUser.uid).catch(() => {});
      throw dbError;
    }

    return NextResponse.json(
      {
        id: docRef.id,
        ...partnerData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating partner:", error);
    return NextResponse.json(
      { error: "Failed to create partner" },
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
