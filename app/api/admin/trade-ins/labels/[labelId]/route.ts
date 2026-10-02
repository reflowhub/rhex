import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveLabelRefund } from "@/lib/shipping-labels";

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
