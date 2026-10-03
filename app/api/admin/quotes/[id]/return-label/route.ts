import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { toAdminQuote } from "@/lib/admin-quote";
import { readLabelUpload } from "@/lib/label-upload";
import { recordPartnerReturnLabel } from "@/lib/shipping-labels";

// ---------------------------------------------------------------------------
// POST /api/admin/quotes/[id]/return-label — Upload the return label a Mode C
// partner made, for Reflow to print and post the device back
// ---------------------------------------------------------------------------
// multipart/form-data: file (PDF), trackingNumber, labelCostAUD (optional),
// replaceLabelId (when replacing the current return label)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const upload = await readLabelUpload(await request.formData(), { withPdf: true });
    if (!upload.ok) {
      return NextResponse.json({ error: upload.error }, { status: 400 });
    }

    const result = await recordPartnerReturnLabel(id, {
      pdf: upload.pdf!,
      fileName: upload.fileName!,
      trackingNumber: upload.trackingNumber,
      labelCostAUD: upload.labelCostAUD,
      admin: adminUser,
      replaceLabelId: upload.replaceLabelId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const quoteDoc = await adminDb.collection("quotes").doc(id).get();
    return NextResponse.json(await toAdminQuote(id, quoteDoc.data()!));
  } catch (error) {
    console.error("Error adding return label:", error);
    return NextResponse.json(
      { error: "Failed to add return label" },
      { status: 500 }
    );
  }
}
