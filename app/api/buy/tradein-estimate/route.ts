import { NextRequest, NextResponse } from "next/server";
import { getDevices, getPrices } from "@/lib/device-cache";
import { getActivePriceList } from "@/lib/categories";
import { getTodayFXRate, convertPrice } from "@/lib/fx";
import { SELL_GRADE_LABELS } from "@/lib/grades";

// GET /api/buy/tradein-estimate?deviceId=xxx
// Returns all grade prices for a device, converted NZD→AUD.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId")?.trim() ?? "";

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 }
      );
    }

    // Find device in cache
    const allDevices = await getDevices();
    const device = allDevices.find((d) => d.id === deviceId && d.active);

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Get active price list for this device's category
    const category = device.category ?? "Phone";
    const priceListId = await getActivePriceList(category);
    if (!priceListId) {
      return NextResponse.json(
        { error: "No pricing available" },
        { status: 404 }
      );
    }

    // Look up grade prices
    const prices = await getPrices(priceListId);
    const devicePrices = prices.get(device.id);
    if (!devicePrices) {
      return NextResponse.json(
        { error: "No pricing available for this device" },
        { status: 404 }
      );
    }

    // Convert NZD → AUD
    const rates = await getTodayFXRate();
    const grades: Record<string, { label: string; priceAUD: number }> = {};

    for (const [gradeKey, priceNZD] of Object.entries(devicePrices)) {
      if (priceNZD == null || priceNZD <= 0) continue;
      grades[gradeKey] = {
        label: SELL_GRADE_LABELS[gradeKey] ?? gradeKey,
        priceAUD: convertPrice(priceNZD, "AUD", rates.NZD_AUD, 5),
      };
    }

    if (Object.keys(grades).length === 0) {
      return NextResponse.json(
        { error: "No pricing available for this device" },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      deviceId: device.id,
      make: device.make,
      model: device.model,
      storage: device.storage,
      grades,
      currency: "AUD",
    });

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return response;
  } catch (error) {
    console.error("Error fetching trade-in estimate:", error);
    return NextResponse.json(
      { error: "Failed to fetch trade-in estimate" },
      { status: 500 }
    );
  }
}
