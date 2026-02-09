import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

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
// GET /api/business/estimate/[id] — Fetch bulk quote with all device lines
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const quoteDoc = await adminDb.collection("bulkQuotes").doc(id).get();
    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: "Bulk quote not found" },
        { status: 404 }
      );
    }

    const quoteData = quoteDoc.data()!;

    // Fetch all device lines
    const devicesSnapshot = await adminDb
      .collection(`bulkQuotes/${id}/devices`)
      .get();

    const deviceLines = devicesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        rawInput: data.rawInput,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        matchConfidence: data.matchConfidence,
        quantity: data.quantity,
        assumedGrade: data.assumedGrade,
        indicativePriceNZD: data.indicativePriceNZD,
        actualGrade: data.actualGrade ?? null,
        actualPriceNZD: data.actualPriceNZD ?? null,
        inspectionNotes: data.inspectionNotes ?? null,
      };
    });

    return NextResponse.json({
      id: quoteDoc.id,
      businessName: quoteData.businessName,
      contactName: quoteData.contactName,
      contactEmail: quoteData.contactEmail,
      contactPhone: quoteData.contactPhone,
      type: quoteData.type,
      assumedGrade: quoteData.assumedGrade,
      totalDevices: quoteData.totalDevices,
      totalIndicativeNZD: quoteData.totalIndicativeNZD,
      matchedCount: quoteData.matchedCount ?? 0,
      unmatchedCount: quoteData.unmatchedCount ?? 0,
      status: quoteData.status,
      paymentMethod: quoteData.paymentMethod ?? null,
      payIdPhone: quoteData.payIdPhone ?? null,
      bankBSB: quoteData.bankBSB ?? null,
      bankAccountNumber: quoteData.bankAccountNumber ?? null,
      bankAccountName: quoteData.bankAccountName ?? null,
      createdAt: serializeTimestamp(quoteData.createdAt),
      acceptedAt: serializeTimestamp(quoteData.acceptedAt),
      receivedAt: serializeTimestamp(quoteData.receivedAt),
      paidAt: serializeTimestamp(quoteData.paidAt),
      devices: deviceLines,
    });
  } catch (error) {
    console.error("Error fetching bulk quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch bulk quote" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/business/estimate/[id] — Accept the estimate (provide details)
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const quoteDoc = await adminDb.collection("bulkQuotes").doc(id).get();
    if (!quoteDoc.exists) {
      return NextResponse.json(
        { error: "Bulk quote not found" },
        { status: 404 }
      );
    }

    const quoteData = quoteDoc.data()!;

    if (quoteData.status !== "estimated") {
      return NextResponse.json(
        { error: "Quote has already been accepted or processed" },
        { status: 400 }
      );
    }

    const {
      businessName,
      contactName,
      contactEmail,
      contactPhone,
      paymentMethod,
      payIdPhone,
      bankBSB,
      bankAccountNumber,
      bankAccountName,
    } = body;

    // Validate required fields
    if (!contactName || !contactEmail || !contactPhone || !paymentMethod) {
      return NextResponse.json(
        {
          error:
            "contactName, contactEmail, contactPhone, and paymentMethod are required",
        },
        { status: 400 }
      );
    }

    if (
      paymentMethod !== "payid" &&
      paymentMethod !== "bank_transfer"
    ) {
      return NextResponse.json(
        { error: "paymentMethod must be 'payid' or 'bank_transfer'" },
        { status: 400 }
      );
    }

    if (paymentMethod === "payid" && !payIdPhone) {
      return NextResponse.json(
        { error: "payIdPhone is required for PayID" },
        { status: 400 }
      );
    }

    if (
      paymentMethod === "bank_transfer" &&
      (!bankBSB || !bankAccountNumber || !bankAccountName)
    ) {
      return NextResponse.json(
        {
          error:
            "bankBSB, bankAccountNumber, and bankAccountName are required for bank transfer",
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: "accepted",
      businessName: businessName || quoteData.businessName,
      contactName,
      contactEmail,
      contactPhone,
      paymentMethod,
      payIdPhone: paymentMethod === "payid" ? payIdPhone : null,
      bankBSB: paymentMethod === "bank_transfer" ? bankBSB : null,
      bankAccountNumber:
        paymentMethod === "bank_transfer" ? bankAccountNumber : null,
      bankAccountName:
        paymentMethod === "bank_transfer" ? bankAccountName : null,
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await adminDb.collection("bulkQuotes").doc(id).update(updateData);

    return NextResponse.json({
      id,
      ...quoteData,
      ...updateData,
      acceptedAt: new Date().toISOString(),
      createdAt: serializeTimestamp(quoteData.createdAt),
    });
  } catch (error) {
    console.error("Error accepting bulk quote:", error);
    return NextResponse.json(
      { error: "Failed to accept bulk quote" },
      { status: 500 }
    );
  }
}
