import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { checkQuoteExpiry } from "@/lib/quote-expiry";
import { isQuoteStatus } from "@/lib/quote-status";
import { toAdminQuote } from "@/lib/admin-quote";
import {
  transitionQuote,
  transitionErrorStatus,
} from "@/lib/transition-quote";

// ---------------------------------------------------------------------------
// GET /api/admin/quotes/[id] — Get full quote detail including device info
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    // Apply any passed deadline (auto-transitions if expired)
    await checkQuoteExpiry("quotes", id);

    const quoteDoc = await adminDb.collection("quotes").doc(id).get();
    if (!quoteDoc.exists) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json(await toAdminQuote(id, quoteDoc.data()!));
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/quotes/[id] — Move a quote to a new status
// ---------------------------------------------------------------------------
// Body: { status, reason?, ...fields for that transition } — see
// lib/quote-transitions.ts for what each transition requires and writes.

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;
    const body = await request.json();
    const { status, reason, ...payload } = body ?? {};

    if (!isQuoteStatus(status)) {
      return NextResponse.json(
        { error: "A valid status is required" },
        { status: 400 }
      );
    }

    const result = await transitionQuote(id, status, {
      actor: "admin",
      admin: adminUser,
      payload,
      reason: typeof reason === "string" ? reason : null,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: transitionErrorStatus(result.code) }
      );
    }

    return NextResponse.json(await toAdminQuote(id, result.quote));
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
  }
}
