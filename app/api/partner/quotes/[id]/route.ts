import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePartner } from "@/lib/partner-auth";
import { PartnerSession } from "@/lib/partner-auth";
import { transitionQuote } from "@/lib/transition-quote";
import { applyRevisionExpiry } from "@/lib/revision-expiry";
import { serializeTimestamp } from "@/lib/serialize";

// ---------------------------------------------------------------------------
// GET /api/partner/quotes/[id] — Get a single quote, verify ownership
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const { id } = await params;

    // Try single quote first
    const quoteDoc = await adminDb.collection("quotes").doc(id).get();
    if (quoteDoc.exists) {
      const raw = quoteDoc.data()!;
      // Sandbox quotes are hidden from the partner portal
      if (raw.partnerId !== partner.id || raw.sandbox === true) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Check for revision expiry
      const data = (await applyRevisionExpiry(quoteDoc))!;

      // Fetch device info
      let device: Record<string, unknown> | null = null;
      if (data.deviceId) {
        const deviceDoc = await adminDb
          .collection("devices")
          .doc(data.deviceId)
          .get();
        if (deviceDoc.exists) {
          device = deviceDoc.data() as Record<string, unknown>;
        }
      }

      return NextResponse.json({
        id: quoteDoc.id,
        type: "quote",
        deviceId: data.deviceId,
        deviceMake: device?.make ?? "",
        deviceModel: device?.model ?? "",
        deviceStorage: device?.storage ?? "",
        grade: data.grade,
        quotePriceNZD: data.quotePriceNZD,
        publicPriceNZD: data.publicPriceNZD ?? null,
        displayCurrency: data.displayCurrency ?? "NZD",
        status: data.status,
        partnerMode: data.partnerMode ?? null,
        customerName: data.customerName ?? null,
        customerEmail: data.customerEmail ?? null,
        customerPhone: data.customerPhone ?? null,
        inspectionGrade: data.inspectionGrade ?? null,
        revisedPriceNZD: data.revisedPriceNZD ?? null,
        revisedDeviceId: data.revisedDeviceId ?? null,
        revisedDeviceMake: data.revisedDeviceMake ?? null,
        revisedDeviceModel: data.revisedDeviceModel ?? null,
        revisedDeviceStorage: data.revisedDeviceStorage ?? null,
        revisedAt: serializeTimestamp(data.revisedAt),
        revisionExpiresAt: serializeTimestamp(data.revisionExpiresAt),
        returningAt: serializeTimestamp(data.returningAt),
        returnedAt: serializeTimestamp(data.returnedAt),
        createdAt: serializeTimestamp(data.createdAt),
        expiresAt: serializeTimestamp(data.expiresAt),
        acceptedAt: serializeTimestamp(data.acceptedAt),
      });
    }

    // Try bulk quote
    const bulkDoc = await adminDb.collection("bulkQuotes").doc(id).get();
    if (bulkDoc.exists) {
      const data = bulkDoc.data()!;
      if (data.partnerId !== partner.id || data.sandbox === true) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // The portal redirects bulk quotes to /partner/estimate/[id], which
      // loads the full detail from /api/partner/estimate/[id]
      return NextResponse.json({
        id: bulkDoc.id,
        type: "bulkQuote",
        status: data.status,
      });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching partner quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/partner/quotes/[id] — Respond to a revised quote
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (!["accept_revision", "reject_revision"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept_revision' or 'reject_revision'" },
        { status: 400 }
      );
    }

    const quoteRef = adminDb.collection("quotes").doc(id);
    const quoteDoc = await quoteRef.get();

    if (
      !quoteDoc.exists ||
      quoteDoc.data()!.partnerId !== partner.id ||
      quoteDoc.data()!.sandbox === true
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const transition = await transitionQuote(
      id,
      action === "accept_revision" ? "inspected" : "returning",
      { actor: "partner", actorId: partner.id }
    );
    if (!transition.ok) {
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
      status: action === "accept_revision" ? "inspected" : "returning",
    });
  } catch (error) {
    console.error("Error responding to revision:", error);
    return NextResponse.json(
      { error: "Failed to respond to revision" },
      { status: 500 }
    );
  }
}
