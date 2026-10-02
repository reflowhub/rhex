import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRevisionExpiry } from "@/lib/revision-expiry";
import { serializeTimestamp } from "@/lib/serialize";
import { isQuoteStatus } from "@/lib/quote-status";
import { allowedTransitions, type QuoteData } from "@/lib/quote-transitions";
import {
  transitionQuote,
  transitionErrorStatus,
} from "@/lib/transition-quote";

// ---------------------------------------------------------------------------
// Response shape (shared by GET and PUT)
// ---------------------------------------------------------------------------

const TIMESTAMP_FIELDS = [
  "createdAt",
  "expiresAt",
  "acceptedAt",
  "termsAcceptedAt",
  "shippedAt",
  "receivedAt",
  "onHoldAt",
  "revisedAt",
  "revisionExpiresAt",
  "revisionAcceptedAt",
  "revisionRejectedAt",
  "inspectedAt",
  "paidAt",
  "returningAt",
  "returnedAt",
  "expiredAt",
  "cancelledAt",
] as const;

const PLAIN_FIELDS = [
  "deviceId",
  "grade",
  "quotePriceNZD",
  "quotePriceDisplay",
  "displayCurrency",
  "status",
  "tradeInRef",
  "termsVersion",
  "customerName",
  "customerEmail",
  "customerPhone",
  "shippingAddress",
  "paymentMethod",
  "payIdPhone",
  "bankBSB",
  "bankAccountNumber",
  "bankAccountName",
  "customerId",
  "partnerMode",
  "imei",
  "receivedImei",
  "receivedSerial",
  "lateArrival",
  "inspectionGrade",
  "revisedPriceNZD",
  "revisedDeviceId",
  "revisedDeviceMake",
  "revisedDeviceModel",
  "revisedDeviceStorage",
  "revisionAutoExpired",
  "revisionForceAccepted",
  "heldFrom",
  "holdReason",
  "releaseNote",
  "returnReason",
  "cancelReason",
  "cancelNote",
  "platform",
  "geoCountry",
  "geoCity",
  "geoRegion",
] as const;

async function toAdminQuote(id: string, data: QuoteData) {
  let device: Record<string, unknown> | null = null;
  if (typeof data.deviceId === "string" && data.deviceId) {
    const deviceDoc = await adminDb.collection("devices").doc(data.deviceId).get();
    if (deviceDoc.exists) device = deviceDoc.data()!;
  }

  const partnerId = (data.partnerId as string) ?? null;
  let partnerName: string | null = null;
  if (partnerId) {
    const partnerDoc = await adminDb.collection("partners").doc(partnerId).get();
    if (partnerDoc.exists) {
      partnerName = (partnerDoc.data()?.name as string) ?? null;
    }
  }

  const quote: Record<string, unknown> = {
    id,
    device: {
      id: data.deviceId ?? "",
      make: (device?.make as string) ?? "",
      model: (device?.model as string) ?? "",
      storage: (device?.storage as string) ?? "",
    },
    partnerId,
    partnerName,
    sandbox: data.sandbox === true,
  };
  for (const field of PLAIN_FIELDS) quote[field] = data[field] ?? null;
  for (const field of TIMESTAMP_FIELDS) {
    quote[field] = serializeTimestamp(data[field]);
  }

  const history = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  quote.statusHistory = history.map((entry: Record<string, unknown>) => ({
    ...entry,
    at: serializeTimestamp(entry.at),
  }));
  quote.allowedTransitions = allowedTransitions(data, "admin");

  return quote;
}

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

    // Check for revision expiry (auto-transitions if expired)
    await checkRevisionExpiry("quotes", id);

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
