import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { saveAlias } from "@/lib/matching";
import { requireAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate: () => Date };
    return ts.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/admin/aliases — List all device aliases
// Query params:
//   ?search=  — filter by alias string or device name
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";

    const snapshot = await adminDb
      .collection("deviceAliases")
      .orderBy("createdAt", "desc")
      .get();

    // Batch-fetch all associated devices
    const deviceIdSet = new Set<string>();
    const aliasDocs: { id: string; data: Record<string, unknown> }[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      aliasDocs.push({ id: doc.id, data });
      if (data.deviceId && typeof data.deviceId === "string") {
        deviceIdSet.add(data.deviceId);
      }
    });

    const deviceMap = new Map<
      string,
      { make: string; model: string; storage: string }
    >();
    const deviceIds = Array.from(deviceIdSet);

    if (deviceIds.length > 0) {
      const deviceRefs = deviceIds.map((id) =>
        adminDb.collection("devices").doc(id)
      );
      const deviceDocs = await adminDb.getAll(...deviceRefs);
      deviceDocs.forEach((doc) => {
        if (doc.exists) {
          const data = doc.data()!;
          deviceMap.set(doc.id, {
            make: data.make as string,
            model: data.model as string,
            storage: data.storage as string,
          });
        }
      });
    }

    let aliases = aliasDocs.map(({ id, data }) => {
      const device = deviceMap.get(data.deviceId as string);
      return {
        id,
        alias: data.alias,
        deviceId: data.deviceId,
        deviceName: device
          ? `${device.make} ${device.model} ${device.storage}`
          : null,
        createdBy: data.createdBy ?? "auto",
        createdAt: serializeTimestamp(data.createdAt),
      };
    });

    if (search) {
      aliases = aliases.filter((a) => {
        const combined = `${a.alias ?? ""} ${a.deviceName ?? ""}`.toLowerCase();
        return search.split(/\s+/).every((word) => combined.includes(word));
      });
    }

    return NextResponse.json(aliases);
  } catch (error) {
    console.error("Error fetching aliases:", error);
    return NextResponse.json(
      { error: "Failed to fetch aliases" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/aliases — Create a new device alias
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const body = await request.json();
    const { alias, deviceId } = body;

    if (!alias || !deviceId) {
      return NextResponse.json(
        { error: "alias and deviceId are required" },
        { status: 400 }
      );
    }

    // Validate device exists
    const deviceDoc = await adminDb.collection("devices").doc(deviceId).get();
    if (!deviceDoc.exists) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    await saveAlias(alias, deviceId, "admin");

    const device = deviceDoc.data()!;
    return NextResponse.json(
      {
        alias: alias.trim().toLowerCase(),
        deviceId,
        deviceName: `${device.make} ${device.model} ${device.storage}`,
        createdBy: "admin",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating alias:", error);
    return NextResponse.json(
      { error: "Failed to create alias" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/aliases?deleteId={id} — Delete a device alias
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { searchParams } = new URL(request.url);
    const deleteId = searchParams.get("deleteId");

    if (!deleteId) {
      return NextResponse.json(
        { error: "deleteId is required" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("deviceAliases").doc(deleteId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Alias not found" },
        { status: 404 }
      );
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting alias:", error);
    return NextResponse.json(
      { error: "Failed to delete alias" },
      { status: 500 }
    );
  }
}
