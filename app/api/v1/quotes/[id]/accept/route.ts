import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, canAccess } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { findOrCreateCustomer } from "@/lib/customer-link";
import { sendEmail } from "@/lib/email";
import QuoteAcceptedEmail from "@/emails/quote-accepted";

// ---------------------------------------------------------------------------
// PUT /api/v1/quotes/[id]/accept — Accept quote with customer details
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
    } = body;

    // Get quote first so we can check partnerMode before validation
    const quoteRef = adminDb.collection("quotes").doc(id);
    const quoteDoc = await quoteRef.get();

    // Ownership + sandbox check
    if (!quoteDoc.exists || !canAccess(quoteDoc.data(), partner)) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const existingData = quoteDoc.data()!;

    // Check status
    if (existingData.status !== "quoted") {
      return NextResponse.json(
        { error: "Quote has already been processed" },
        { status: 400 }
      );
    }

    // Check expiry
    if (existingData.expiresAt?.toDate) {
      const expiryDate = existingData.expiresAt.toDate();
      if (expiryDate < new Date()) {
        return NextResponse.json(
          { error: "Quote has expired" },
          { status: 400 }
        );
      }
    }

    const isModeBPartner = existingData.partnerMode === "B";

    // Validate required fields — payment method is optional for Mode B
    // (Reflow Hub pays the partner, not the customer)
    if (
      !customerName ||
      !customerEmail ||
      !customerPhone ||
      !shippingAddress ||
      (!isModeBPartner && !paymentMethod)
    ) {
      const requiredFields = isModeBPartner
        ? "customerName, customerEmail, customerPhone, and shippingAddress are required"
        : "customerName, customerEmail, customerPhone, shippingAddress, and paymentMethod are required";
      return NextResponse.json(
        { error: requiredFields },
        { status: 400 }
      );
    }

    // Validate payment method details (only when provided)
    if (paymentMethod) {
      if (!["payid", "bank_transfer"].includes(paymentMethod)) {
        return NextResponse.json(
          { error: "paymentMethod must be 'payid' or 'bank_transfer'" },
          { status: 400 }
        );
      }

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
    }

    // Build update
    const updateData: Record<string, unknown> = {
      status: "accepted",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
    };

    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
      if (paymentMethod === "payid") {
        updateData.payIdPhone = payIdPhone;
      } else {
        updateData.bankBSB = bankBSB;
        updateData.bankAccountNumber = bankAccountNumber;
        updateData.bankAccountName = bankAccountName;
      }
    }

    // Accept IMEI if provided and quote doesn't already have one
    if (
      imei &&
      typeof imei === "string" &&
      /^\d{15}$/.test(imei) &&
      !existingData.imei
    ) {
      updateData.imei = imei;
    }

    await quoteRef.update(updateData);

    const isSandbox = existingData.sandbox === true;

    // Auto-create/link customer record (non-blocking) — skip for sandbox
    if (!isSandbox) {
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
          bankAccountNumber:
            paymentMethod === "bank_transfer" ? bankAccountNumber : null,
          bankAccountName:
            paymentMethod === "bank_transfer" ? bankAccountName : null,
          quoteId: id,
          quoteValueNZD: existingData.quotePriceNZD ?? 0,
        });
        await quoteRef.update({ customerId });
      } catch (err) {
        console.error("Customer link error (non-blocking):", err);
      }
    }

    // Fetch device info for email/response
    let device = null;
    if (existingData.deviceId) {
      const deviceDoc = await adminDb
        .collection("devices")
        .doc(existingData.deviceId)
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

    // Send acceptance email (non-blocking) — skip for sandbox
    if (!isSandbox) {
      const deviceLabel = device
        ? `${device.make} ${device.model} ${device.storage}`.trim()
        : "your device";
      sendEmail({
        to: customerEmail,
        subject: "Your trade-in quote has been accepted",
        react: QuoteAcceptedEmail({
          customerName,
          deviceName: deviceLabel,
          quotePrice: existingData.quotePriceNZD ?? 0,
          currency: "NZD",
          quoteId: id,
        }),
      });
    }

    // Fetch updated quote for response
    const updatedDoc = await quoteRef.get();
    const updatedData = updatedDoc.data()!;

    return NextResponse.json({
      id: updatedDoc.id,
      deviceId: updatedData.deviceId,
      grade: updatedData.grade,
      quotePriceNZD: updatedData.quotePriceNZD,
      publicPriceNZD: updatedData.publicPriceNZD ?? null,
      quotePrice: updatedData.quotePriceDisplay ?? updatedData.quotePriceNZD,
      displayCurrency: updatedData.displayCurrency ?? "NZD",
      status: updatedData.status,
      source: updatedData.source ?? null,
      customerName: updatedData.customerName,
      customerEmail: updatedData.customerEmail,
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

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate: () => Date };
    return ts.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
