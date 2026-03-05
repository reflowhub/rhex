import { NextRequest, NextResponse } from "next/server";
import { getDevices, getPrices } from "@/lib/device-cache";
import { getActivePriceList } from "@/lib/categories";
import { getTodayFXRate, convertPrice } from "@/lib/fx";

// GET /api/tradein-price?model=iPhone+15+Pro&storage=128GB
// Public endpoint for Clearvue iOS app to show trade-in offers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get("model")?.trim() ?? "";
    const storage = searchParams.get("storage")?.trim() ?? "";

    if (!model || !storage) {
      return NextResponse.json(
        { error: "model and storage are required" },
        { status: 400 }
      );
    }

    // Find matching device
    const allDevices = await getDevices();
    const device = allDevices.find(
      (d) =>
        d.active &&
        d.category === "Phone" &&
        d.make?.toLowerCase() === "apple" &&
        d.model?.toLowerCase() === model.toLowerCase() &&
        d.storage?.toLowerCase() === storage.toLowerCase()
    );

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Get active price list for Phone category
    const priceListId = await getActivePriceList("Phone");
    if (!priceListId) {
      return NextResponse.json(
        { error: "No pricing available" },
        { status: 404 }
      );
    }

    // Look up prices
    const prices = await getPrices(priceListId);
    const devicePrices = prices.get(device.id);
    if (!devicePrices || devicePrices["A"] == null) {
      return NextResponse.json(
        { error: "No pricing available for this device" },
        { status: 404 }
      );
    }

    // Convert NZD to AUD
    const rates = await getTodayFXRate();
    const priceA = convertPrice(devicePrices["A"], "AUD", rates.NZD_AUD, 5);
    const priceC =
      devicePrices["C"] != null
        ? convertPrice(devicePrices["C"], "AUD", rates.NZD_AUD, 5)
        : null;

    const response = NextResponse.json({
      model: device.model,
      storage: device.storage,
      priceA,
      priceC,
      currency: "AUD",
      sellUrl: "https://rhex.app/sell",
    });

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return response;
  } catch (error) {
    console.error("Error fetching trade-in price:", error);
    return NextResponse.json(
      { error: "Failed to fetch trade-in price" },
      { status: 500 }
    );
  }
}
