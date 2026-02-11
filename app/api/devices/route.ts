import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getDevices } from "@/lib/device-cache";

// GET /api/devices — Public endpoint to list devices for consumer quote flow
// Supports optional ?make= filter and ?id= to fetch a single device
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const make = searchParams.get("make")?.trim() ?? "";
    const id = searchParams.get("id")?.trim() ?? "";

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

    // List all devices (from cache)
    const allDevices = await getDevices();

    let devices = allDevices.map((d) => ({
      id: d.id,
      make: d.make,
      model: d.model,
      storage: d.storage,
    }));

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

    const response = NextResponse.json(devices);
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return response;
  } catch (error) {
    console.error("Error fetching devices:", error);
    return NextResponse.json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    );
  }
}
