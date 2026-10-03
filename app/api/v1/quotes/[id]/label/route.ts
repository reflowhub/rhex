import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, canAccess } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { serializeTimestamp } from "@/lib/serialize";
import { quoteLabelArrangement } from "@/lib/partner-config";
import { isModeC } from "@/lib/quote-transitions";
import { recordPartnerLabel } from "@/lib/shipping-labels";
import { v1QuoteStatus } from "@/lib/v1-quote";

// ---------------------------------------------------------------------------
// PUT /api/v1/quotes/[id]/label — A Mode C partner records the inbound label
// it made and sent the customer (docs/partners/OPPO.md, 2e)
// ---------------------------------------------------------------------------
// Body: { trackingNumber, carrier? ("auspost") }. Only for trade-ins accepted
// while the partner makes inbound labels. Sending the same tracking number
// again changes nothing; a different one is refused (RHEX staff replace it).
// Not in docs/API-REFERENCE.md until the partner's logistics are decided.

const TRACKING = /^[A-Z0-9]{8,40}$/;
const CARRIER = /^[a-z0-9_-]{2,30}$/;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiKey(request);
  if (result instanceof NextResponse) return result;
  const partner: ApiKeyPartner = result;

  const rl = await checkRateLimit(partner.apiKeyId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }

    const quoteDoc = await adminDb.collection("quotes").doc(id).get();
    const data = quoteDoc.data();
    if (!data || !canAccess(data, partner)) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    if (!isModeC(data) || quoteLabelArrangement(data).inbound.providedBy !== "partner") {
      return NextResponse.json(
        { error: "RHEX makes the shipping label for this trade-in" },
        { status: 403 }
      );
    }

    const trackingNumber =
      typeof body.trackingNumber === "string"
        ? body.trackingNumber.replace(/\s/g, "").toUpperCase()
        : "";
    if (!TRACKING.test(trackingNumber)) {
      return NextResponse.json(
        { error: "trackingNumber is required (8 to 40 letters and digits)" },
        { status: 400 }
      );
    }
    const carrier =
      body.carrier === undefined ? "auspost" : String(body.carrier).trim().toLowerCase();
    if (!CARRIER.test(carrier)) {
      return NextResponse.json({ error: "carrier is not valid" }, { status: 400 });
    }

    const recorded = await recordPartnerLabel(id, {
      trackingNumber,
      carrier,
      apiKeyId: partner.apiKeyId,
    });
    if (!recorded.ok) {
      return NextResponse.json({ error: recorded.error }, { status: recorded.status });
    }

    const q = (await adminDb.collection("quotes").doc(id).get()).data()!;
    return NextResponse.json({
      id,
      status: v1QuoteStatus(q),
      tradeInRef: q.tradeInRef ?? null,
      trackingNumber: q.trackingNumber ?? null,
      labelSentAt: serializeTimestamp(q.labelSentAt),
      postByAt: serializeTimestamp(q.postByAt),
    });
  } catch (error) {
    console.error("Error recording partner label:", error);
    return NextResponse.json(
      { error: "Failed to record label" },
      { status: 500 }
    );
  }
}
