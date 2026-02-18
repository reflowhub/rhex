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

