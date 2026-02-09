import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

// POST /api/device-requests — Submit a device request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device, email } = body;

    if (!device || typeof device !== "string" || !device.trim()) {
      return NextResponse.json(
        { error: "device is required" },
        { status: 400 }
      );
    }

    await adminDb.collection("deviceRequests").add({
      device: device.trim(),
      email: email && typeof email === "string" ? email.trim() : null,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error saving device request:", error);
    return NextResponse.json(
      { error: "Failed to save request" },
      { status: 500 }
    );
  }
}

// GET /api/device-requests — List device requests (admin)
export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("deviceRequests")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching device requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
