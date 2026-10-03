import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveLabelRefund } from "@/lib/shipping-labels";

// ---------------------------------------------------------------------------
// GET /api/admin/trade-ins/labels/[labelId] — Download a label's PDF (e.g. a
// partner's return label to print)
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ labelId: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { labelId } = await params;

    const blob = (await adminDb.collection("labelBlobs").doc(labelId).get()).data();
    if (!blob?.data) {
      return NextResponse.json({ error: "This label has no PDF" }, { status: 404 });
    }
    const pdf = Buffer.from(blob.data as Uint8Array);
    const fileName = String(blob.fileName ?? "label.pdf").replace(/[^\w.-]/g, "_");
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error serving label:", error);
    return NextResponse.json({ error: "Failed to load label" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/trade-ins/labels/[labelId] — Resolve a pending label refund
// ---------------------------------------------------------------------------
// Body: { refundState: "refunded" | "not_refundable" }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ labelId: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { labelId } = await params;
    const { refundState } = await request.json();

    if (refundState !== "refunded" && refundState !== "not_refundable") {
      return NextResponse.json(
        { error: "refundState must be 'refunded' or 'not_refundable'" },
        { status: 400 }
      );
    }

    const result = await resolveLabelRefund(labelId, refundState, adminUser);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ labelId, refundState });
  } catch (error) {
    console.error("Error resolving label refund:", error);
    return NextResponse.json(
      { error: "Failed to update label" },
      { status: 500 }
    );
  }
}
