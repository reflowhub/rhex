import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, canAccess } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { applyQuoteExpiry } from "@/lib/quote-expiry";
import { serializeV1BulkQuote } from "@/lib/v1-bulk-quote";

// ---------------------------------------------------------------------------
// GET /api/v1/bulk-quotes/[id] — Get bulk quote with line items
// ---------------------------------------------------------------------------

export async function GET(
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

    const doc = await adminDb.collection("bulkQuotes").doc(id).get();

    // Ownership + sandbox check
    if (!doc.exists || !canAccess(doc.data(), partner)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check for revision expiry
    const data = (await applyQuoteExpiry(doc))!;

    return NextResponse.json(await serializeV1BulkQuote(doc.ref, data));
  } catch (error) {
    console.error("Error fetching v1 bulk quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch bulk quote" },
      { status: 500 }
    );
  }
}
