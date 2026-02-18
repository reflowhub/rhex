import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// GET /api/admin/device-requests — List device requests with optional filters
// Query params:
//   ?status=   — filter by request status
//   ?search=   — search by device name or email
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { searchParams } = new URL(request.url);
    const statusFilter =
      searchParams.get("status")?.toLowerCase().trim() ?? "";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";

    let query: FirebaseFirestore.Query = adminDb.collection("deviceRequests");

    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }

    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    let requests = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        device: data.device ?? "",
        email: data.email ?? null,
        status: data.status ?? "pending",
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    if (search) {
      requests = requests.filter((r) => {
        const combined = `${r.device} ${r.email ?? ""}`.toLowerCase();
        return search
          .split(/\s+/)
          .every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching device requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch device requests" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/device-requests — Update a device request's status
// Body: { id: string, status: string }
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["pending", "reviewed", "added", "dismissed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("deviceRequests").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Device request not found" },
        { status: 404 }
      );
    }

    await docRef.update({ status });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating device request:", error);
    return NextResponse.json(
      { error: "Failed to update device request" },
      { status: 500 }
    );
  }
}
