import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { checkQuoteExpiry } from "@/lib/quote-expiry";
import { maskTail } from "@/lib/quote-money";
import { customerTimeline } from "@/lib/quote-timeline";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { serializeTimestamp } from "@/lib/serialize";
import { transitionQuote, transitionErrorStatus } from "@/lib/transition-quote";

// ---------------------------------------------------------------------------
// Public response shape
// ---------------------------------------------------------------------------
// Anyone with the quote ID can call these endpoints, so responses only carry
// the fields the customer pages need. Never spread the raw document: it holds
// contact details, payout details, geo data and partner pricing.

const PUBLIC_FIELDS = [
  "deviceId",
  "grade",
  "imei",
  "quotePriceNZD",
  "quotePriceDisplay",
  "displayCurrency",
  "fxRate",
  "status",
  "tradeInRef",
  "trackingNumber",
  "paymentMethod",
  "inspectionGrade",
  "revisedPriceNZD",
  "revisedPriceDisplay",
  "revisedDeviceId",
  "revisedDeviceMake",
  "revisedDeviceModel",
  "revisedDeviceStorage",
  "revisionAutoExpired",
] as const;

const PUBLIC_TIMESTAMP_FIELDS = [
  "createdAt",
  "expiresAt",
  "acceptedAt",
  "revisedAt",
  "revisionExpiresAt",
  "revisionAcceptedAt",
  "revisionRejectedAt",
  "returningAt",
  "returnedAt",
  "labelSentAt",
  "postByAt",
  "shippedAt",
  "receivedAt",
  "inspectedAt",
  "paidAt",
  "expiredAt",
  "cancelledAt",
] as const;

async function getDeviceSummary(deviceId: unknown) {
  if (typeof deviceId !== "string" || !deviceId) return null;
  const deviceDoc = await adminDb.collection("devices").doc(deviceId).get();
  if (!deviceDoc.exists) return null;
  const deviceData = deviceDoc.data();
  return {
    id: deviceDoc.id,
    make: deviceData?.make,
    model: deviceData?.model,
    storage: deviceData?.storage,
  };
}

async function toPublicQuote(
  id: string,
  data: FirebaseFirestore.DocumentData
): Promise<Record<string, unknown>> {
  const quote: Record<string, unknown> = { id };
  for (const field of PUBLIC_FIELDS) {
    if (data[field] !== undefined) quote[field] = data[field];
  }
  for (const field of PUBLIC_TIMESTAMP_FIELDS) {
    if (data[field]) quote[field] = serializeTimestamp(data[field]);
  }
  if (data.payIdPhone) quote.payIdPhone = maskTail(data.payIdPhone);
  if (data.bankAccountNumber) {
    quote.bankAccountNumber = maskTail(data.bankAccountNumber);
  }
  quote.hasLabel =
    typeof data.labelId === "string" &&
    (data.status === "accepted" || data.status === "shipped");
  // {step, at} only: statusHistory reasons can hold internal notes
  quote.timeline = customerTimeline(data);
  quote.device = await getDeviceSummary(data.deviceId);
  return quote;
}

/** Quotes the public endpoints must not change (decided in the Mode A/B review). */
function isPublicWriteBlocked(data: FirebaseFirestore.DocumentData): boolean {
  return data.partnerMode === "B" || data.sandbox === true;
}

// GET /api/quote/[id] — Get a quote by ID, including device info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Apply any passed deadline (auto-transitions if expired)
    await checkQuoteExpiry("quotes", id);

    const quoteDoc = await adminDb.collection("quotes").doc(id).get();

    if (!quoteDoc.exists) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json(await toPublicQuote(quoteDoc.id, quoteDoc.data()!));
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// PUT /api/quote/[id] — Accept a quote with customer details, mark it as
// posted, or respond to a revised quote
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`ip:${ip}:/api/quote/[id]:PUT`, 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const quoteRef = adminDb.collection("quotes").doc(id);
    const quoteDoc = await quoteRef.get();

    if (!quoteDoc.exists || isPublicWriteBlocked(quoteDoc.data()!)) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // --- "I've posted it" ---
    if (body.action === "mark_shipped") {
      const result = await transitionQuote(id, "shipped", { actor: "customer" });
      if (!result.ok) {
        return NextResponse.json(
          {
            error:
              result.code === "invalid_transition"
                ? "This trade-in can't be marked as posted"
                : result.message,
          },
          { status: transitionErrorStatus(result.code) }
        );
      }
      return NextResponse.json(await toPublicQuote(id, result.quote));
    }

    // --- Revision response ---
    if (
      body.action === "accept_revision" ||
      body.action === "reject_revision"
    ) {
      const result = await transitionQuote(
        id,
        body.action === "accept_revision" ? "inspected" : "returning",
        { actor: "customer" }
      );
      if (!result.ok) {
        return NextResponse.json(
          {
            error:
              result.code === "invalid_transition"
                ? "Quote is not in revised status"
                : result.message,
          },
          { status: transitionErrorStatus(result.code) }
        );
      }
      return NextResponse.json(await toPublicQuote(id, result.quote));
    }

    // --- Acceptance ---
    const result = await transitionQuote(id, "accepted", {
      actor: "customer",
      payload: body,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.code === "invalid_transition"
              ? "Quote has already been processed"
              : result.message,
        },
        { status: transitionErrorStatus(result.code) }
      );
    }

    return NextResponse.json(await toPublicQuote(id, result.quote));
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
  }
}
