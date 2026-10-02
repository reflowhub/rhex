import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { serializeTimestamp } from "@/lib/serialize";

// ---------------------------------------------------------------------------
// Unmatched parcels (terms §17): parcels that can't be tied to a quote.
// The photo is stored as bytes on the doc (private, served by the photo route).
// ---------------------------------------------------------------------------

const MAX_PHOTO_BYTES = 900 * 1024;
const LIST_LIMIT = 50;

// GET /api/admin/trade-ins/unmatched — Open unmatched parcels, newest first
export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const snap = await adminDb
      .collection("unmatchedParcels")
      .where("status", "==", "open")
      .get();

    const parcels = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          scanText: d.scanText ?? null,
          imei: d.imei ?? null,
          note: d.note ?? null,
          hasPhoto: !!d.photo,
          createdAt: serializeTimestamp(d.createdAt),
          createdBy: d.createdBy ?? null,
        };
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, LIST_LIMIT);

    return NextResponse.json({ parcels });
  } catch (error) {
    console.error("Error listing unmatched parcels:", error);
    return NextResponse.json(
      { error: "Failed to load unmatched parcels" },
      { status: 500 }
    );
  }
}

// POST /api/admin/trade-ins/unmatched — Log a parcel
// multipart/form-data: scanText, imei, note, photo (image, optional)
export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const form = await request.formData();
    const scanText = String(form.get("scanText") ?? "").trim() || null;
    const imei = String(form.get("imei") ?? "").replace(/\D/g, "") || null;
    const note = String(form.get("note") ?? "").trim() || null;
    const photo = form.get("photo");

    if (!scanText && !imei && !note && !(photo instanceof File)) {
      return NextResponse.json(
        { error: "Add at least a scan, IMEI, note or photo" },
        { status: 400 }
      );
    }

    let photoBytes: Buffer | null = null;
    let photoContentType: string | null = null;
    if (photo instanceof File && photo.size > 0) {
      if (!photo.type.startsWith("image/")) {
        return NextResponse.json({ error: "Photo must be an image" }, { status: 400 });
      }
      if (photo.size > MAX_PHOTO_BYTES) {
        return NextResponse.json(
          { error: "Photo must be under 900 KB" },
          { status: 400 }
        );
      }
      photoBytes = Buffer.from(await photo.arrayBuffer());
      photoContentType = photo.type;
    }

    const ref = await adminDb.collection("unmatchedParcels").add({
      scanText,
      imei,
      note,
      photo: photoBytes,
      photoContentType,
      status: "open",
      createdAt: new Date(),
      createdBy: adminUser.email,
    });

    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (error) {
    console.error("Error logging unmatched parcel:", error);
    return NextResponse.json(
      { error: "Failed to log parcel" },
      { status: 500 }
    );
  }
}
