import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase-admin";
import {
  PARTNER_NOTIFICATIONS,
  retryPartnerNotification,
} from "@/lib/partner-notifications";

// POST /api/admin/quotes/[id]/partner-results/[notificationId] — Retry now
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notificationId: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;
  try {
    const { id, notificationId } = await params;
    const doc = await adminDb.collection(PARTNER_NOTIFICATIONS).doc(notificationId).get();
    if (!doc.exists || doc.data()?.quoteId !== id) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    const result = await retryPartnerNotification(notificationId, adminUser);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ status: result.status });
  } catch (error) {
    console.error("Error retrying partner result:", error);
    return NextResponse.json({ error: "Failed to retry" }, { status: 500 });
  }
}
