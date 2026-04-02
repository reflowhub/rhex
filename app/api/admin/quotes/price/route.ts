import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { readGrades } from "@/lib/grades";
import { getActivePriceList, getCategoryGrades } from "@/lib/categories";
import { getTodayFXRate, convertPrice } from "@/lib/fx";

// ---------------------------------------------------------------------------
// GET /api/admin/quotes/price?deviceId=X&grade=A
// Returns the NZD and AUD price for a device + grade combination.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");
    const grade = searchParams.get("grade")?.toUpperCase();

    if (!deviceId || !grade) {
      return NextResponse.json(
        { error: "deviceId and grade are required" },
        { status: 400 }
      );
    }

    // Look up device
    const deviceDoc = await adminDb.collection("devices").doc(deviceId).get();
    if (!deviceDoc.exists) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const deviceData = deviceDoc.data()!;
    const category = (deviceData.category as string) ?? "Phone";

    // Validate grade
    const categoryGrades = await getCategoryGrades(category);
    const validKeys =
      categoryGrades.length > 0
        ? categoryGrades.map((g) => g.key)
        : ["A", "B", "C", "D", "E"];

    if (!validKeys.includes(grade)) {
      return NextResponse.json(
        { error: `Invalid grade "${grade}" for ${category}` },
        { status: 400 }
      );
    }

    // Look up price from active price list
    const priceListId = await getActivePriceList(category);
    if (!priceListId) {
      return NextResponse.json(
        { error: "No pricing available for this device category" },
        { status: 404 }
      );
    }

    const priceDoc = await adminDb
      .doc(`priceLists/${priceListId}/prices/${deviceId}`)
      .get();

    if (!priceDoc.exists) {
      return NextResponse.json(
        { error: "No pricing available for this device" },
        { status: 404 }
      );
    }

    const grades = readGrades(priceDoc.data()!);
    const quotePriceNZD = grades[grade];

    if (quotePriceNZD === undefined || quotePriceNZD === null) {
      return NextResponse.json(
        { error: `No price for grade ${grade}` },
        { status: 404 }
      );
    }

    // Convert to AUD
    const rates = await getTodayFXRate();
    const quotePriceAUD = convertPrice(
      Number(quotePriceNZD),
      "AUD",
      rates.NZD_AUD,
      5
    );

    return NextResponse.json({
      quotePriceNZD: Number(quotePriceNZD),
      quotePriceAUD,
      fxRate: rates.NZD_AUD,
    });
  } catch (error) {
    console.error("Error fetching quote price:", error);
    return NextResponse.json(
      { error: "Failed to fetch price" },
      { status: 500 }
    );
  }
}
