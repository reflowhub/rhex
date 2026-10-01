import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, canAccess } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { applyRevisionExpiry } from "@/lib/revision-expiry";
import { serializeTimestamp } from "@/lib/serialize";

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
    const data = (await applyRevisionExpiry(doc))!;

    // Fetch device lines
    const devicesSnapshot = await doc.ref.collection("devices").get();

    const devices = devicesSnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      id: doc.id,
      type: data.type,
      category: data.category ?? null,
      assumedGrade: data.assumedGrade,
      totalDevices: data.totalDevices,
      totalIndicativeNZD: data.totalIndicativeNZD,
      totalPublicNZD: data.totalPublicNZD ?? null,
      totalIndicative: data.totalIndicativeDisplay ?? data.totalIndicativeNZD,
      totalPublic: data.totalPublicDisplay ?? data.totalPublicNZD ?? null,
      displayCurrency: data.displayCurrency ?? "NZD",
      matchedCount: data.matchedCount,
      unmatchedCount: data.unmatchedCount,
      status: data.status,
      source: data.source ?? null,
      revisedTotalNZD: data.revisedTotalNZD ?? null,
      createdAt: serializeTimestamp(data.createdAt),
      acceptedAt: serializeTimestamp(data.acceptedAt),
      revisedAt: serializeTimestamp(data.revisedAt),
      revisionExpiresAt: serializeTimestamp(data.revisionExpiresAt),
      returningAt: serializeTimestamp(data.returningAt),
      returnedAt: serializeTimestamp(data.returnedAt),
      devices,
    });
  } catch (error) {
    console.error("Error fetching v1 bulk quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch bulk quote" },
      { status: 500 }
    );
  }
}
