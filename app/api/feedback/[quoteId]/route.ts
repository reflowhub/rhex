import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// GET /api/feedback/[quoteId] — Check feedback status + load quote context
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;

    const quoteDoc = await adminDb.collection("quotes").doc(quoteId).get();
    if (!quoteDoc.exists || quoteDoc.data()?.status !== "paid") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const quoteData = quoteDoc.data()!;

    // Check for existing feedback
    const existing = await adminDb
      .collection("feedbackEntries")
      .where("quoteId", "==", quoteId)
      .limit(1)
      .get();

    if (!existing.empty) {
      const entry = existing.docs[0].data();
      return NextResponse.json({
        submitted: true,
        rating: entry.rating,
        comment: entry.comment,
      });
    }

    // Fetch device name
    let deviceName = "your device";
    if (quoteData.deviceId) {
      const deviceDoc = await adminDb
        .collection("devices")
        .doc(quoteData.deviceId)
        .get();
      if (deviceDoc.exists) {
        const d = deviceDoc.data()!;
        deviceName = `${d.make} ${d.model} ${d.storage}`.trim();
      }
    }

    return NextResponse.json({
      submitted: false,
      customerName: quoteData.customerName ?? null,
      deviceName,
    });
  } catch (error) {
    console.error("Error checking feedback:", error);
    return NextResponse.json(
      { error: "Failed to check feedback status" },
      { status: 500 }
    );
  }
}

// POST /api/feedback/[quoteId] — Submit feedback
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;
    const body = await request.json();
    const { rating, comment } = body;

    // Validate rating
    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer from 1 to 5" },
        { status: 400 }
      );
    }

    // Validate comment length
    if (comment && typeof comment === "string" && comment.length > 1000) {
      return NextResponse.json(
        { error: "Comment must be 1000 characters or less" },
        { status: 400 }
      );
    }

    // Verify quote exists and is paid
    const quoteDoc = await adminDb.collection("quotes").doc(quoteId).get();
    if (!quoteDoc.exists || quoteDoc.data()?.status !== "paid") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const quoteData = quoteDoc.data()!;

    // Check for existing feedback (one per quote)
    const existing = await adminDb
      .collection("feedbackEntries")
      .where("quoteId", "==", quoteId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: "Feedback already submitted for this quote" },
        { status: 409 }
      );
    }

    // Derive raffle month
    const now = new Date();
    const raffleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    await adminDb.collection("feedbackEntries").add({
      quoteId,
      customerId: quoteData.customerId ?? null,
      customerName: quoteData.customerName ?? "Unknown",
      customerEmail: quoteData.customerEmail ?? "",
      rating,
      comment: typeof comment === "string" ? comment.trim() || null : null,
      raffleMonth,
      raffleWinner: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
