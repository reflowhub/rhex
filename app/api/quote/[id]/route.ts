import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { findOrCreateCustomer } from "@/lib/customer-link";
import { sendEmail } from "@/lib/email";
import QuoteAcceptedEmail from "@/emails/quote-accepted";
import { checkRevisionExpiry } from "@/lib/revision-expiry";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { updateIfStatus } from "@/lib/status-transition";
import { serializeTimestamp } from "@/lib/serialize";
import { TRADEIN_TERMS_VERSION } from "@/lib/tradein-terms";

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
  "paymentMethod",
  "inspectionGrade",
  "revisedPriceNZD",
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
] as const;

/** Mask all but the last 3 characters, e.g. "•••• 123". */
function maskTail(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const compact = value.replace(/\s/g, "");
  return compact.length > 3 ? `•••• ${compact.slice(-3)}` : "••••";
}

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

    // Check for revision expiry (auto-transitions if expired)
    await checkRevisionExpiry("quotes", id);

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

// PUT /api/quote/[id] — Accept a quote with customer details, or respond to
// a revised quote
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

    const existingData = quoteDoc.data()!;

    // --- Handle revision response ---
    if (
      body.action === "accept_revision" ||
      body.action === "reject_revision"
    ) {
      if (existingData.status !== "revised") {
        return NextResponse.json(
          { error: "Quote is not in revised status" },
          { status: 400 }
        );
      }

      // Check expiry
      if (existingData.revisionExpiresAt?.toDate) {
        if (existingData.revisionExpiresAt.toDate() < new Date()) {
          return NextResponse.json(
            { error: "Revision response period has expired" },
            { status: 400 }
          );
        }
      }

      const updateData: Record<string, unknown> = {};

      if (body.action === "accept_revision") {
        updateData.status = "inspected";
        updateData.revisionAcceptedAt =
          admin.firestore.FieldValue.serverTimestamp();
      } else {
        updateData.status = "returning";
        updateData.returningAt =
          admin.firestore.FieldValue.serverTimestamp();
        updateData.revisionRejectedAt =
          admin.firestore.FieldValue.serverTimestamp();
      }

      // Only one concurrent request can respond to the revision
      if (!(await updateIfStatus(quoteRef, "revised", updateData))) {
        return NextResponse.json(
          { error: "Quote is not in revised status" },
          { status: 409 }
        );
      }

      const updatedDoc = await quoteRef.get();
      return NextResponse.json(
        await toPublicQuote(updatedDoc.id, updatedDoc.data()!)
      );
    }

    // --- Original acceptance flow ---
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      paymentMethod,
      payIdPhone,
      bankBSB,
      bankAccountNumber,
      bankAccountName,
      imei,
      termsAccepted,
    } = body;

    // Validate required fields
    if (!customerName || !customerEmail || !customerPhone || !shippingAddress || !paymentMethod) {
      return NextResponse.json(
        {
          error:
            "customerName, customerEmail, customerPhone, shippingAddress, and paymentMethod are required",
        },
        { status: 400 }
      );
    }

    if (termsAccepted !== true) {
      return NextResponse.json(
        { error: "You must accept the Trade-In Terms & Conditions" },
        { status: 400 }
      );
    }

    // Validate payment method
    if (!["payid", "bank_transfer"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "paymentMethod must be 'payid' or 'bank_transfer'" },
        { status: 400 }
      );
    }

    // Validate payment details based on method
    if (paymentMethod === "payid" && !payIdPhone) {
      return NextResponse.json(
        { error: "payIdPhone is required for PayID payment method" },
        { status: 400 }
      );
    }

    if (
      paymentMethod === "bank_transfer" &&
      (!bankBSB || !bankAccountNumber || !bankAccountName)
    ) {
      return NextResponse.json(
        {
          error:
            "bankBSB, bankAccountNumber, and bankAccountName are required for bank transfer",
        },
        { status: 400 }
      );
    }

    // Check quote is still in "quoted" status
    if (existingData.status !== "quoted") {
      return NextResponse.json(
        { error: "Quote has already been processed" },
        { status: 400 }
      );
    }

    // Check quote hasn't expired
    if (existingData.expiresAt?.toDate) {
      const expiryDate = existingData.expiresAt.toDate();
      if (expiryDate < new Date()) {
        return NextResponse.json(
          { error: "Quote has expired" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: "accepted",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      termsVersion: TRADEIN_TERMS_VERSION,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      paymentMethod,
    };

    if (paymentMethod === "payid") {
      updateData.payIdPhone = payIdPhone;
    } else {
      updateData.bankBSB = bankBSB;
      updateData.bankAccountNumber = bankAccountNumber;
      updateData.bankAccountName = bankAccountName;
    }

    // Accept IMEI if provided and quote doesn't already have one
    if (imei && typeof imei === "string" && /^\d{15}$/.test(imei) && !existingData.imei) {
      updateData.imei = imei;
    }

    // Only one concurrent request can accept the quote; side effects below
    // run only for the request that made the change
    if (!(await updateIfStatus(quoteRef, "quoted", updateData))) {
      return NextResponse.json(
        { error: "Quote has already been processed" },
        { status: 409 }
      );
    }

    // Auto-create/link customer record
    try {
      const customerId = await findOrCreateCustomer({
        type: "individual",
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        shippingAddress,
        paymentMethod,
        payIdPhone: paymentMethod === "payid" ? payIdPhone : null,
        bankBSB: paymentMethod === "bank_transfer" ? bankBSB : null,
        bankAccountNumber: paymentMethod === "bank_transfer" ? bankAccountNumber : null,
        bankAccountName: paymentMethod === "bank_transfer" ? bankAccountName : null,
        quoteId: id,
        quoteValueNZD: existingData.quotePriceNZD ?? 0,
      });
      await quoteRef.update({ customerId });
    } catch (err) {
      console.error("Customer link error (non-blocking):", err);
    }

    const updatedDoc = await quoteRef.get();
    const publicQuote = await toPublicQuote(updatedDoc.id, updatedDoc.data()!);

    // Send acceptance confirmation email (non-blocking)
    const device = publicQuote.device as
      | { make: string; model: string; storage: string }
      | null;
    const deviceLabel = device
      ? `${device.make} ${device.model} ${device.storage}`.trim()
      : "your device";
    sendEmail({
      to: customerEmail,
      subject: "Your trade-in quote has been accepted",
      react: QuoteAcceptedEmail({
        customerName,
        deviceName: deviceLabel,
        quotePrice: existingData.quotePriceDisplay ?? existingData.quotePriceNZD ?? 0,
        currency: existingData.displayCurrency ?? "AUD",
        quoteId: id,
        rhexLabel: true,
      }),
    });

    return NextResponse.json(publicQuote);
  } catch (error) {
    console.error("Error accepting quote:", error);
    return NextResponse.json(
      { error: "Failed to accept quote" },
      { status: 500 }
    );
  }
}
