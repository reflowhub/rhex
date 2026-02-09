import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// GET /api/business/estimate/[id]/export — Download CSV of device breakdown
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

    // Build CSV
    const headers = [
      "Line",
      "Raw Input",
      "Matched Device",
      "Confidence",
      "Quantity",
      "Grade",
      "Unit Price (NZD)",
      "Line Total (NZD)",
    ];

    const rows = devicesSnapshot.docs.map((doc, index) => {
      const data = doc.data();
      const unitPrice =
        data.quantity > 0
          ? (data.indicativePriceNZD / data.quantity).toFixed(2)
          : "0.00";
      return [
        String(index + 1),
        escapeCSV(data.rawInput || ""),
        escapeCSV(data.deviceName || "Unmatched"),
        data.matchConfidence || "low",
        String(data.quantity || 1),
        data.assumedGrade || quoteData.assumedGrade || "C",
        unitPrice,
        (data.indicativePriceNZD || 0).toFixed(2),
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    const fileName = `estimate-${id.substring(0, 8)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting bulk quote:", error);
    return NextResponse.json(
      { error: "Failed to export bulk quote" },
      { status: 500 }
    );
  }
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
