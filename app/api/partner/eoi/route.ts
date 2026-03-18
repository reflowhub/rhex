import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// POST /api/partner/eoi — Submit an expression of interest to become a partner
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, contactName, email, phone, message } = body;

    if (!businessName || !contactName || !email) {
      return NextResponse.json(
        { error: "Business name, contact name, and email are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const eoiData = {
      businessName: businessName.trim(),
      contactName: contactName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      message: message?.trim() || null,
      status: "new",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await adminDb.collection("partnerEOIs").add(eoiData);

    return NextResponse.json(
      { success: true },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error submitting partner EOI:", error);
    return NextResponse.json(
      { error: "Failed to submit expression of interest" },
      { status: 500 }
    );
  }
}
