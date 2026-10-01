import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";
import { buildPartnerEstimate, EstimateError } from "@/lib/partner-estimate";

// ---------------------------------------------------------------------------
// POST /api/partner/estimate — Create bulk estimate at partner rates (Mode B)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  if (!partner.modes.includes("B")) {
    return NextResponse.json(
      { error: "Mode B access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const discount = partner.partnerRateDiscount ?? 10;

    const estimate = await buildPartnerEstimate({
      csv: body.csv,
      devices: body.devices,
      category: body.category,
      assumedGrade: body.assumedGrade,
      discount,
    });

    // Create bulk quote document
    const bulkQuoteData: Record<string, unknown> = {
      type: estimate.type,
      category: estimate.category,
      assumedGrade: estimate.assumedGrade,
      totalDevices: estimate.totalDevices,
      totalIndicativeNZD: estimate.totalIndicativeNZD,
      totalPublicNZD: estimate.totalPublicNZD,
      matchedCount: estimate.matchedCount,
      unmatchedCount: estimate.unmatchedCount,
      status: "estimated",
      partnerId: partner.id,
      partnerMode: "B",
      partnerRateDiscount: discount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedAt: null,
    };

    const bulkQuoteRef = await adminDb.collection("bulkQuotes").add(bulkQuoteData);

    // Write device lines in batches
    const BATCH_SIZE = 200;
    for (let i = 0; i < estimate.lines.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      estimate.lines.slice(i, i + BATCH_SIZE).forEach((line) => {
        batch.set(bulkQuoteRef.collection("devices").doc(), line);
      });
      await batch.commit();
    }

    return NextResponse.json(
      {
        id: bulkQuoteRef.id,
        totalDevices: estimate.totalDevices,
        totalIndicativeNZD: estimate.totalIndicativeNZD,
        matchedCount: estimate.matchedCount,
        unmatchedCount: estimate.unmatchedCount,
        lineCount: estimate.lines.length,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof EstimateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating partner estimate:", error);
    return NextResponse.json(
      { error: "Failed to create bulk estimate" },
      { status: 500 }
    );
  }
}
