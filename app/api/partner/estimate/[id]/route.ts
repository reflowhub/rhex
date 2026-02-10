import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";

// ---------------------------------------------------------------------------
// GET /api/partner/estimate/[id] — Get bulk estimate detail
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("bulkQuotes").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data()!;
    if (data.partnerId !== partner.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch device lines
    const devicesSnapshot = await doc.ref
      .collection("devices")
      .get();

    const devices = devicesSnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      id: doc.id,
      type: data.type,
      assumedGrade: data.assumedGrade,
      totalDevices: data.totalDevices,
      totalIndicativeNZD: data.totalIndicativeNZD,
      totalPublicNZD: data.totalPublicNZD ?? null,
      matchedCount: data.matchedCount,
      unmatchedCount: data.unmatchedCount,
      status: data.status,
      partnerMode: data.partnerMode,
      partnerRateDiscount: data.partnerRateDiscount,
      createdAt: serializeTimestamp(data.createdAt),
      acceptedAt: serializeTimestamp(data.acceptedAt),
      devices,
    });
  } catch (error) {
    console.error("Error fetching partner estimate:", error);
    return NextResponse.json(
      { error: "Failed to fetch estimate" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/partner/estimate/[id] — Accept bulk estimate
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const docRef = adminDb.collection("bulkQuotes").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data()!;
    if (data.partnerId !== partner.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "accept") {
      if (data.status !== "estimated") {
        return NextResponse.json(
          { error: "Can only accept estimates in 'estimated' status" },
          { status: 400 }
        );
      }

      await docRef.update({
        status: "accepted",
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ status: "accepted" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating partner estimate:", error);
    return NextResponse.json(
      { error: "Failed to update estimate" },
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
