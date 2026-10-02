import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { matchParcel } from "@/lib/parcel-match";
import type { QuoteData } from "@/lib/quote-transitions";
import {
  isOpsVisible,
  loadDevices,
  loadOpenTradeIns,
  summarizeQuote,
} from "@/lib/trade-in-ops";

// ---------------------------------------------------------------------------
// GET /api/admin/trade-ins/lookup?q= — Find the quote a parcel belongs to
// ---------------------------------------------------------------------------
// Searches accepted and shipped quotes, plus expired quotes that had a label
// (a late parcel can still be received). Matches on tracking number (the
// scan contains it), TI- reference, IMEI, quote ID or customer name/email.

const MAX_RESULTS = 20;

/** Expired quotes that had been sent a label. Needs the (status, postByAt) index. */
async function loadExpiredWithLabel(): Promise<{ id: string; data: QuoteData }[]> {
  try {
    const snap = await adminDb
      .collection("quotes")
      .where("status", "==", "expired")
      .where("postByAt", ">", new Date(0))
      .get();
    return snap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter(({ data }) => isOpsVisible(data));
  } catch (error) {
    console.error("Expired-quote lookup failed (index deployed?):", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (!q) {
      return NextResponse.json({ error: "Enter something to search for" }, { status: 400 });
    }

    const [open, expired] = await Promise.all([
      loadOpenTradeIns(),
      loadExpiredWithLabel(),
    ]);

    const matches = [...open, ...expired]
      .map(({ id, data }) => ({
        id,
        data,
        matchedOn: matchParcel(q, { id, ...data }),
      }))
      .filter((m) => m.matchedOn !== null)
      .slice(0, MAX_RESULTS);

    const devices = await loadDevices(matches.map((m) => m.data));
    return NextResponse.json({
      matches: matches.map(({ id, data, matchedOn }) => ({
        ...summarizeQuote(id, data, devices),
        matchedOn,
      })),
    });
  } catch (error) {
    console.error("Error looking up parcel:", error);
    return NextResponse.json(
      { error: "Failed to look up parcel" },
      { status: 500 }
    );
  }
}
