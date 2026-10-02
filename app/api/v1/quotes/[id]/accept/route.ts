import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, canAccess } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { serializeTimestamp } from "@/lib/serialize";
import { transitionQuote } from "@/lib/transition-quote";
import { v1QuoteStatus } from "@/lib/v1-quote";

// ---------------------------------------------------------------------------
// PUT /api/v1/quotes/[id]/accept — Accept quote with customer details
// ---------------------------------------------------------------------------
// Mode C: the customer's name, email, phone, AU address and consent to the
// current trade-in terms (termsAccepted + termsVersion) are required, and
// payment details are refused. Mode B: contact is optional, payment refused.
// The rules live in lib/quote-transitions.ts.

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

    // Ownership + sandbox check
    const quoteDoc = await adminDb.collection("quotes").doc(id).get();
    if (!quoteDoc.exists || !canAccess(quoteDoc.data(), partner)) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const transition = await transitionQuote(id, "accepted", {
      actor: "apiKey",
      actorId: partner.apiKeyId,
      payload: body,
    });
    if (!transition.ok) {
      // v1 contract: every rejected accept is a 400
      const status = transition.code === "not_found" ? 404 : 400;
      const error =
        transition.code === "invalid_transition"
          ? "Quote has already been processed"
          : transition.message;
      return NextResponse.json({ error }, { status });
    }
    const updatedData = transition.quote;

    // Fetch device info for the response
    let device = null;
    if (typeof updatedData.deviceId === "string" && updatedData.deviceId) {
      const deviceDoc = await adminDb
        .collection("devices")
        .doc(updatedData.deviceId)
        .get();
      if (deviceDoc.exists) {
        const deviceData = deviceDoc.data();
        device = {
          id: deviceDoc.id,
          make: deviceData?.make,
          model: deviceData?.model,
          storage: deviceData?.storage,
        };
      }
    }

    return NextResponse.json({
      id,
      deviceId: updatedData.deviceId,
      grade: updatedData.grade,
      quotePriceNZD: updatedData.quotePriceNZD,
      publicPriceNZD: updatedData.publicPriceNZD ?? null,
      quotePrice: updatedData.quotePriceDisplay ?? updatedData.quotePriceNZD,
      displayCurrency: updatedData.displayCurrency ?? "NZD",
      status: v1QuoteStatus(updatedData),
      source: updatedData.source ?? null,
      tradeInRef: updatedData.tradeInRef ?? null,
      customerName: updatedData.customerName ?? null,
      customerEmail: updatedData.customerEmail ?? null,
      createdAt: serializeTimestamp(updatedData.createdAt),
      expiresAt: serializeTimestamp(updatedData.expiresAt),
      acceptedAt: serializeTimestamp(updatedData.acceptedAt),
      device,
    });
  } catch (error) {
    console.error("Error accepting v1 quote:", error);
    return NextResponse.json(
      { error: "Failed to accept quote" },
      { status: 500 }
    );
  }
}
