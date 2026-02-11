import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { findDuplicateDevice } from "@/lib/device-uniqueness";

// GET /api/admin/devices — List all devices, with optional ?search= and ?category= filters
export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";
    const category = searchParams.get("category") ?? "";

    const snapshot = await adminDb.collection("devices").get();

    let devices: Record<string, unknown>[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter by category
    if (category) {
      devices = devices.filter(
        (device) => (device.category ?? "Phone") === category
      );
    }

    // In-memory fuzzy search across make, model, storage
    if (search) {
      devices = devices.filter((device) => {
        const make = String(device.make ?? "").toLowerCase();
        const model = String(device.model ?? "").toLowerCase();
        const storage = String(device.storage ?? "").toLowerCase();
        const combined = `${make} ${model} ${storage}`;
        // Check if every word in the search query appears somewhere in the combined fields
        const searchWords = search.split(/\s+/).filter(Boolean);
        return searchWords.every((word) => combined.includes(word));
      });
    }

    // Sort by make, then model, then storage
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

// POST /api/admin/devices — Create a new device
export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const body = await request.json();
    const { make, model, storage, category } = body;

    if (!make || !model || !storage) {
      return NextResponse.json(
        { error: "make, model, and storage are required" },
        { status: 400 }
      );
    }

    // Check for duplicate device
    const duplicate = await findDuplicateDevice(make, model, storage);
    if (duplicate) {
      return NextResponse.json(
        {
          error: `A device with this make/model/storage already exists (${duplicate.make} ${duplicate.model} ${duplicate.storage})`,
        },
        { status: 409 }
      );
    }

    // Auto-assign next deviceId using a Firestore transaction
    const counterRef = adminDb.doc("counters/devices");
    let deviceId: number;

    await adminDb.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      if (!counterDoc.exists) {
        // Initialize counter if it doesn't exist
        deviceId = 1;
        transaction.set(counterRef, { nextId: 2 });
      } else {
        deviceId = counterDoc.data()?.nextId ?? 1;
        transaction.update(counterRef, { nextId: deviceId + 1 });
      }
    });

    const modelStorage = `${model} ${storage}`;
    const deviceData = {
      deviceId: deviceId!,
      make,
      model,
      storage,
      modelStorage,
      category: category || "Phone",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection("devices").add(deviceData);

    return NextResponse.json(
      { id: docRef.id, ...deviceData },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating device:", error);
    return NextResponse.json(
      { error: "Failed to create device" },
      { status: 500 }
    );
  }
}
