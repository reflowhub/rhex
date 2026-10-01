import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiKeyPartner {
  id: string;
  apiKeyId: string;
  name: string;
  code: string;
  contactEmail: string;
  modes: string[];
  status: string;
  currency: "AUD" | "NZD";
  // Mode A
  commissionModel: string | null;
  commissionPercent: number | null;
  commissionFlat: number | null;
  commissionTiers: unknown | null;
  payoutFrequency: string | null;
  // Mode B
  partnerRateDiscount: number | null;
  // Sandbox
  sandbox: boolean;
}

// ---------------------------------------------------------------------------
// hashApiKey — SHA-256 hash of an API key
// ---------------------------------------------------------------------------

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// ---------------------------------------------------------------------------
// verifyApiKey — Extract + verify API key, return partner data
// ---------------------------------------------------------------------------

export async function verifyApiKey(
  request: NextRequest
): Promise<ApiKeyPartner | null> {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) return null;

    const keyHash = hashApiKey(apiKey);

    const keySnapshot = await adminDb
      .collection("apiKeys")
      .where("keyHash", "==", keyHash)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (keySnapshot.empty) return null;

    const keyDoc = keySnapshot.docs[0];
    const keyData = keyDoc.data();

    // Look up the partner
    const partnerDoc = await adminDb
      .collection("partners")
      .doc(keyData.partnerId)
      .get();

    if (!partnerDoc.exists) return null;

    const data = partnerDoc.data()!;

    // Only allow active partners with Mode B
    if (data.status !== "active") return null;
    if (!data.modes?.includes("B")) return null;

    // Fire-and-forget: update lastUsedAt
    adminDb
      .collection("apiKeys")
      .doc(keyDoc.id)
      .update({ lastUsedAt: new Date() })
      .catch(() => {});

    return {
      id: partnerDoc.id,
      apiKeyId: keyDoc.id,
      name: data.name ?? "",
      code: data.code ?? "",
      contactEmail: data.contactEmail ?? "",
      modes: data.modes ?? [],
      status: data.status,
      currency: (data.currency as "AUD" | "NZD") ?? "AUD",
      commissionModel: data.commissionModel ?? null,
      commissionPercent: data.commissionPercent ?? null,
      commissionFlat: data.commissionFlat ?? null,
      commissionTiers: data.commissionTiers ?? null,
      payoutFrequency: data.payoutFrequency ?? "monthly",
      partnerRateDiscount: data.partnerRateDiscount ?? null,
      sandbox: keyData.sandbox === true,
    };
  } catch (error) {
    console.error("API key verification failed:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// canAccess — Whether an API key may see a quote/bulk quote document.
// Sandbox keys only see sandbox docs; production keys only see production docs.
// ---------------------------------------------------------------------------

export function canAccess(
  data: FirebaseFirestore.DocumentData | undefined,
  partner: ApiKeyPartner
): boolean {
  if (!data || data.partnerId !== partner.id) return false;
  return (data.sandbox === true) === partner.sandbox;
}

// ---------------------------------------------------------------------------
// requireApiKey — Returns partner or 401 response
// ---------------------------------------------------------------------------

export async function requireApiKey(
  request: NextRequest
): Promise<ApiKeyPartner | NextResponse> {
  const partner = await verifyApiKey(request);

  if (!partner) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  return partner;
}
