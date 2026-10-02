import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listPartnerNotifications } from "@/lib/partner-notifications";

// GET /api/admin/quotes/[id]/partner-results — Mode C results sent to the partner
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;
  try {
    const { id } = await params;
    return NextResponse.json(await listPartnerNotifications(id));
  } catch (error) {
    console.error("Error listing partner results:", error);
    return NextResponse.json({ error: "Failed to load partner results" }, { status: 500 });
  }
}
