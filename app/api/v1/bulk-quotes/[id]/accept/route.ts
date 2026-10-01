import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, canAccess } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { updateIfStatus } from "@/lib/status-transition";
import { serializeV1BulkQuote } from "@/lib/v1-bulk-quote";

// ---------------------------------------------------------------------------
// PUT /api/v1/bulk-quotes/[id]/accept — Accept a bulk estimate
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
    const docRef = adminDb.collection("bulkQuotes").doc(id);
    const doc = await docRef.get();

    // Ownership + sandbox check
    if (!doc.exists || !canAccess(doc.data(), partner)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const accepted = await updateIfStatus(docRef, "estimated", {
      status: "accepted",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (!accepted) {
      return NextResponse.json(
        { error: "Can only accept bulk quotes in 'estimated' status" },
        { status: 400 }
      );
    }

    const updatedDoc = await docRef.get();
    return NextResponse.json(
      await serializeV1BulkQuote(docRef, updatedDoc.data()!)
    );
  } catch (error) {
    console.error("Error accepting v1 bulk quote:", error);
    return NextResponse.json(
      { error: "Failed to accept bulk quote" },
      { status: 500 }
    );
  }
}
