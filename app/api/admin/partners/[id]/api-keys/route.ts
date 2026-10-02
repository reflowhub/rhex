import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { hashApiKey, partnerApiMode } from "@/lib/api-key-auth";
import crypto from "crypto";
import { serializeTimestamp } from "@/lib/serialize";

// ---------------------------------------------------------------------------
// GET /api/admin/partners/[id]/api-keys — List API keys for a partner
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  try {
    const { id } = await params;

    // Verify partner exists
    const partnerDoc = await adminDb.collection("partners").doc(id).get();
    if (!partnerDoc.exists) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    const snapshot = await adminDb
      .collection("apiKeys")
      .where("partnerId", "==", id)
      .get();

    const keys = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          keyPrefix: data.keyPrefix ?? "",
          label: data.label ?? "",
          sandbox: data.sandbox === true,
          status: data.status ?? "active",
          createdAt: serializeTimestamp(data.createdAt),
          lastUsedAt: serializeTimestamp(data.lastUsedAt),
        };
      })
      .sort((a, b) => {
        const dateA = a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
        const dateB = b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;
        return dateB - dateA;
      });

    return NextResponse.json(keys);
  } catch (error) {
    console.error("Error listing API keys:", error);
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/partners/[id]/api-keys — Generate a new API key
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  try {
    const { id } = await params;

    // Verify partner exists and has an API mode (B or C)
    const partnerDoc = await adminDb.collection("partners").doc(id).get();
    if (!partnerDoc.exists) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    const partnerData = partnerDoc.data()!;
    if (!partnerApiMode(partnerData)) {
      return NextResponse.json(
        { error: "Partner must have Mode B or C to use API access" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const label = (body.label as string)?.trim() || "Default";
    const sandbox = body.sandbox === true;

    // Generate key: rhx_test_ for sandbox, rhx_ for production
    const prefix = sandbox ? "rhx_test_" : "rhx_";
    const plainKey = prefix + crypto.randomBytes(32).toString("hex");
    const keyHash = hashApiKey(plainKey);
    const keyPrefix = plainKey.slice(0, sandbox ? 17 : 12);

    const docRef = await adminDb.collection("apiKeys").add({
      keyHash,
      keyPrefix,
      partnerId: id,
      label,
      sandbox,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      revokedAt: null,
      lastUsedAt: null,
      createdBy: adminUser.uid,
    });

    // Return the plaintext key — this is the ONLY time it is shown
    return NextResponse.json(
      { id: docRef.id, key: plainKey, keyPrefix, label, sandbox },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error generating API key:", error);
    return NextResponse.json(
      { error: "Failed to generate API key" },
      { status: 500 }
    );
  }
}
