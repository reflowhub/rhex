import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/admin/raffle — List raffle entries filtered by month
export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month =
      searchParams.get("month") ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const snapshot = await adminDb
      .collection("feedbackEntries")
      .where("raffleMonth", "==", month)
      .orderBy("createdAt", "desc")
      .get();

    const entries = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        quoteId: data.quoteId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        rating: data.rating,
        comment: data.comment,
        raffleWinner: data.raffleWinner ?? false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ month, entries });
  } catch (error) {
    console.error("Error fetching raffle entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch raffle entries" },
      { status: 500 }
    );
  }
}
