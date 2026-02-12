import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getDevices } from "@/lib/device-cache";

// ---------------------------------------------------------------------------
// GET /api/admin/audit-log/snapshots/[id] — Fetch a price list snapshot
// Supports ?format=csv to download as CSV
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;
    const { id } = await params;

    const doc = await adminDb.doc(`priceListSnapshots/${id}`).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    if (format === "csv") {
      // Build CSV from snapshot prices + device lookup for names
      const prices = (data.prices ?? {}) as Record<
        string,
        Record<string, number>
      >;
      const devices = await getDevices();
      const deviceMap = new Map(devices.map((d) => [d.id, d]));

      // Collect all grade keys from the snapshot data
      const gradeKeySet = new Set<string>();
      for (const grades of Object.values(prices)) {
        for (const key of Object.keys(grades)) {
          gradeKeySet.add(key);
        }
      }
      const gradeKeys = [...gradeKeySet].sort();

      const csvLines: string[] = [];
      csvLines.push(
        ["DeviceID", "Make", "Model", "Storage", ...gradeKeys].join(",")
      );

      for (const [deviceDocId, grades] of Object.entries(prices)) {
        const device = deviceMap.get(deviceDocId);
        const deviceId = device?.deviceId ?? "";
        const make = device?.make ?? "";
        const model = device?.model ?? "";
        const storage = device?.storage ?? "";
        const gradeValues = gradeKeys.map((k) => grades[k] ?? 0);
        csvLines.push(
          [deviceId, make, `"${model}"`, storage, ...gradeValues].join(",")
        );
      }

      const csvContent = csvLines.join("\n");
      const filename = `snapshot-${data.priceListId}-${id}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: return JSON
    return NextResponse.json({
      id: doc.id,
      priceListId: data.priceListId,
      category: data.category,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      adminEmail: data.adminEmail,
      deviceCount: data.deviceCount,
      prices: data.prices,
    });
  } catch (error) {
    console.error("Error fetching snapshot:", error);
    return NextResponse.json(
      { error: "Failed to fetch snapshot" },
      { status: 500 }
    );
  }
}
