import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// GET /api/admin/eoi — List all partner expressions of interest
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") ?? "";

    let query: FirebaseFirestore.Query = adminDb
      .collection("partnerEOIs")
      .orderBy("createdAt", "desc");

    if (statusFilter && statusFilter !== "all") {
      query = query.where("status", "==", statusFilter);
    }

    const snapshot = await query.get();
    const eois = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        businessName: data.businessName ?? "",
        contactName: data.contactName ?? "",
        email: data.email ?? "",
        phone: data.phone ?? null,
        message: data.message ?? null,
        status: data.status ?? "new",
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json(eois);
  } catch (error) {
    console.error("Error fetching EOIs:", error);
    return NextResponse.json(
      { error: "Failed to fetch expressions of interest" },
      { status: 500 }
    );
  }
}
