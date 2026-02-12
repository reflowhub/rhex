import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import type { AuditAction } from "@/lib/audit-log";

// ---------------------------------------------------------------------------
// GET /api/admin/audit-log — Paginated audit log with optional filters
// Query params: ?limit=50&action=csv_upload&category=Phone&cursor=<lastDocId>
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const action = searchParams.get("action") as AuditAction | null;
    const category = searchParams.get("category");
    const cursor = searchParams.get("cursor");

    let query: FirebaseFirestore.Query = adminDb
      .collection("priceAuditLog")
      .orderBy("timestamp", "desc");

    if (action) {
      query = query.where("action", "==", action);
    }
    if (category) {
      query = query.where("category", "==", category);
    }

    // Cursor-based pagination
    if (cursor) {
      const cursorDoc = await adminDb.doc(`priceAuditLog/${cursor}`).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    query = query.limit(limit + 1); // fetch one extra to check hasMore

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    const entries = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        timestamp: data.timestamp?.toDate?.()?.toISOString() ?? null,
        adminUid: data.adminUid,
        adminEmail: data.adminEmail,
        action: data.action,
        priceListId: data.priceListId ?? null,
        category: data.category,
        summary: data.summary,
        details: data.details ?? {},
      };
    });

    const nextCursor = hasMore ? docs[docs.length - 1].id : null;

    return NextResponse.json({ entries, hasMore, nextCursor });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    );
  }
}
