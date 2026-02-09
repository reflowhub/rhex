import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PartnerSession {
  id: string;
  name: string;
  code: string;
  contactEmail: string;
  modes: string[];
  status: string;
  authUid: string;
  // Mode A
  commissionModel: string | null;
  commissionPercent: number | null;
  commissionFlat: number | null;
  commissionTiers: unknown | null;
  payoutFrequency: string | null;
  // Mode B
  partnerRateDiscount: number | null;
}

// ---------------------------------------------------------------------------
// verifyPartnerSession — Extract + verify session cookie, return partner data
// ---------------------------------------------------------------------------

export async function verifyPartnerSession(
  request: NextRequest
): Promise<PartnerSession | null> {
  try {
    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) return null;

    const decodedClaims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );

    // Look up partner by authUid
    const snapshot = await adminDb
      .collection("partners")
      .where("authUid", "==", decodedClaims.uid)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Only allow active partners
    if (data.status !== "active") return null;

    return {
      id: doc.id,
      name: data.name ?? "",
      code: data.code ?? "",
      contactEmail: data.contactEmail ?? "",
      modes: data.modes ?? [],
      status: data.status,
      authUid: data.authUid,
      commissionModel: data.commissionModel ?? null,
      commissionPercent: data.commissionPercent ?? null,
      commissionFlat: data.commissionFlat ?? null,
      commissionTiers: data.commissionTiers ?? null,
      payoutFrequency: data.payoutFrequency ?? "monthly",
      partnerRateDiscount: data.partnerRateDiscount ?? null,
    };
  } catch (error) {
    console.error("Partner session verification failed:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// requirePartner — Returns partner or 401 response
// ---------------------------------------------------------------------------

export async function requirePartner(
  request: NextRequest
): Promise<PartnerSession | NextResponse> {
  const partner = await verifyPartnerSession(request);

  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return partner;
}
