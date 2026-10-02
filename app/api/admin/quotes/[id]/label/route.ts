import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { toAdminQuote } from "@/lib/admin-quote";
import { MAX_LABEL_BYTES, sendQuoteLabel } from "@/lib/shipping-labels";

// ---------------------------------------------------------------------------
// POST /api/admin/quotes/[id]/label — Upload an AusPost label PDF and email
// it to the customer
// ---------------------------------------------------------------------------
// multipart/form-data: file (PDF), trackingNumber, labelCostAUD (optional),
// replaceLabelId (when replacing the current label)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const form = await request.formData();
    const file = form.get("file");
    const trackingNumber = String(form.get("trackingNumber") ?? "")
      .replace(/\s/g, "")
      .toUpperCase();
    const costInput = String(form.get("labelCostAUD") ?? "").trim();
    const replaceLabelId = String(form.get("replaceLabelId") ?? "") || null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach the label PDF" }, { status: 400 });
    }
    if (!trackingNumber) {
      return NextResponse.json(
        { error: "Tracking number is required" },
        { status: 400 }
      );
    }
    if (file.size > MAX_LABEL_BYTES) {
      return NextResponse.json(
        { error: "Label PDF must be under 900 KB" },
        { status: 400 }
      );
    }

    const pdf = Buffer.from(await file.arrayBuffer());
    if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json(
        { error: "The label must be a PDF" },
        { status: 400 }
      );
    }

    let labelCostAUD: number | null = null;
    if (costInput) {
      labelCostAUD = Number(costInput);
      if (!Number.isFinite(labelCostAUD) || labelCostAUD < 0) {
        return NextResponse.json(
          { error: "Label cost must be a positive number" },
          { status: 400 }
        );
      }
    }

    const result = await sendQuoteLabel(id, {
      pdf,
      fileName: file.name || "label.pdf",
      trackingNumber,
      labelCostAUD,
      admin: adminUser,
      replaceLabelId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const quoteDoc = await adminDb.collection("quotes").doc(id).get();
    return NextResponse.json(await toAdminQuote(id, quoteDoc.data()!));
  } catch (error) {
    console.error("Error sending label:", error);
    return NextResponse.json(
      { error: "Failed to send label" },
      { status: 500 }
    );
  }
}
