import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { transitionQuote } from "@/lib/transition-quote";

// ---------------------------------------------------------------------------
// POST /api/admin/trade-ins/cancel-not-genuine — Clear bot/fake acceptances
// ---------------------------------------------------------------------------
// Body: { quoteIds: string[] }. Each quote is cancelled through the
// transition module with cancelReason "not_genuine"; failures are reported
// per quote.

const MAX_QUOTES = 100;

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const quoteIds: unknown = body?.quoteIds;
    if (
      !Array.isArray(quoteIds) ||
      quoteIds.length === 0 ||
      quoteIds.length > MAX_QUOTES ||
      !quoteIds.every((id) => typeof id === "string" && id)
    ) {
      return NextResponse.json(
        { error: `quoteIds must be 1–${MAX_QUOTES} quote IDs` },
        { status: 400 }
      );
    }

    const cancelled: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of quoteIds as string[]) {
      const result = await transitionQuote(id, "cancelled", {
        actor: "admin",
        admin: adminUser,
        payload: { cancelReason: "not_genuine" },
      });
      if (result.ok) cancelled.push(id);
      else failed.push({ id, error: result.message });
    }

    return NextResponse.json({ cancelled, failed });
  } catch (error) {
    console.error("Error cancelling quotes:", error);
    return NextResponse.json(
      { error: "Failed to cancel quotes" },
      { status: 500 }
    );
  }
}
