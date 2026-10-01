import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, canAccess } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// PUT /api/v1/bulk-quotes/[id]/respond — Accept or reject a revised bulk quote
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
  const rl = checkRateLimit(partner.apiKeyId);
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

    const docRef = adminDb.collection("bulkQuotes").doc(id);
    const doc = await docRef.get();

    if (!doc.exists || !canAccess(doc.data(), partner)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = doc.data()!;

    if (data.status !== "revised") {
      return NextResponse.json(
        { error: "Bulk quote is not in revised status" },
        { status: 400 }
      );
    }

    // Check expiry
    if (data.revisionExpiresAt?.toDate) {
      if (data.revisionExpiresAt.toDate() < new Date()) {
        return NextResponse.json(
          { error: "Revision response period has expired" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (action === "accept") {
      updateData.status = "inspected";
      updateData.revisionAcceptedAt =
        admin.firestore.FieldValue.serverTimestamp();
    } else {
      updateData.status = "returning";
      updateData.returningAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.revisionRejectedAt =
        admin.firestore.FieldValue.serverTimestamp();
    }

    await docRef.update(updateData);

    return NextResponse.json({
      id,
      status: action === "accept" ? "inspected" : "returning",
    });
  } catch (error) {
    console.error("Error responding to bulk quote revision:", error);
    return NextResponse.json(
      { error: "Failed to respond to revision" },
      { status: 500 }
    );
  }
}
