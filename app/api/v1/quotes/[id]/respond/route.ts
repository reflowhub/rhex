import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, canAccess } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { transitionQuote } from "@/lib/transition-quote";

// ---------------------------------------------------------------------------
// PUT /api/v1/quotes/[id]/respond — Accept or reject a revised quote
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth
  const result = await requireApiKey(request);
  if (result instanceof NextResponse) return result;
  const partner: ApiKeyPartner = result;

  // Rate limit
  const rl = await checkRateLimit(partner.apiKeyId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept' or 'reject'" },
        { status: 400 }
      );
    }

    const quoteRef = adminDb.collection("quotes").doc(id);
    const quoteDoc = await quoteRef.get();

    if (!quoteDoc.exists || !canAccess(quoteDoc.data(), partner)) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const transition = await transitionQuote(
      id,
      action === "accept" ? "inspected" : "returning",
      { actor: "apiKey", actorId: partner.apiKeyId }
    );
    if (!transition.ok) {
      // Mode C: the customer answers revised offers on RHEX's quote page
      if (transition.code === "forbidden") {
        return NextResponse.json(
          { error: "The customer responds to revised offers for this quote" },
          { status: 403 }
        );
      }
      // v1 contract: every other rejected response is a 400
      const error =
        transition.code === "invalid_transition"
          ? "Quote is not in revised status"
          : transition.message;
      return NextResponse.json(
        { error },
        { status: transition.code === "not_found" ? 404 : 400 }
      );
    }

    return NextResponse.json({
      id,
      status: action === "accept" ? "inspected" : "returning",
    });
  } catch (error) {
    console.error("Error responding to revision:", error);
    return NextResponse.json(
      { error: "Failed to respond to revision" },
      { status: 500 }
    );
  }
}
