import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// GET /api/devices — Public endpoint to list devices for consumer quote flow
// Supports optional ?make= filter and ?id= to fetch a single device
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const make = searchParams.get("make")?.trim() ?? "";
    const id = searchParams.get("id")?.trim() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";

    // If requesting a single device by ID
    if (id) {
      const doc = await adminDb.collection("devices").doc(id).get();
      if (!doc.exists) {
        return NextResponse.json(
          { error: "Device not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ id: doc.id, ...doc.data() });
    }

    // List all devices
    const snapshot = await adminDb.collection("devices").get();

    let devices: Record<string, unknown>[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      make: doc.data().make,
      model: doc.data().model,
      storage: doc.data().storage,
      category: doc.data().category ?? "Phone",
    }));

    // Filter by category if provided
    if (category) {
      devices = devices.filter(
        (device) =>
          String(device.category ?? "Phone").toLowerCase() ===
          category.toLowerCase()
      );
    }

    // Filter by make if provided
    if (make) {
      devices = devices.filter(
        (device) =>
          String(device.make ?? "").toLowerCase() === make.toLowerCase()
      );
    }

    // Sort by make, model, storage
    devices.sort((a, b) => {
      const makeA = String(a.make ?? "").toLowerCase();
      const makeB = String(b.make ?? "").toLowerCase();
      if (makeA !== makeB) return makeA.localeCompare(makeB);

      const modelA = String(a.model ?? "").toLowerCase();
      const modelB = String(b.model ?? "").toLowerCase();
      if (modelA !== modelB) return modelA.localeCompare(modelB);

      const storageA = String(a.storage ?? "").toLowerCase();
      const storageB = String(b.storage ?? "").toLowerCase();
      return storageA.localeCompare(storageB);
    });

    return NextResponse.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    return NextResponse.json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    );
  }
}
