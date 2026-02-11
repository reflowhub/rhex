import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// POST /api/admin/customers/[id]/notes — Add a note
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { id } = await params;
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const doc = await adminDb.collection("customers").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const note = {
      id: crypto.randomUUID(),
      text: text.trim(),
      createdBy: adminUser.email,
      createdAt: new Date().toISOString(),
    };

    await adminDb
      .collection("customers")
      .doc(id)
      .update({
        notes: admin.firestore.FieldValue.arrayUnion(note),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Error adding note:", error);
    return NextResponse.json(
      { error: "Failed to add note" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/customers/[id]/notes — Remove a note
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { id } = await params;
    const body = await request.json();
    const { noteId } = body;

    if (!noteId) {
      return NextResponse.json(
        { error: "noteId is required" },
        { status: 400 }
      );
    }

    const doc = await adminDb.collection("customers").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    const notes: Record<string, unknown>[] = data.notes ?? [];
    const noteToRemove = notes.find(
      (n) => (n as { id: string }).id === noteId
    );

    if (!noteToRemove) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await adminDb
      .collection("customers")
      .doc(id)
      .update({
        notes: admin.firestore.FieldValue.arrayRemove(noteToRemove),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing note:", error);
    return NextResponse.json(
      { error: "Failed to remove note" },
      { status: 500 }
    );
  }
}
