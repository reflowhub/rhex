import { NextRequest, NextResponse } from "next/server";
import { requirePartner, PartnerSession } from "@/lib/partner-auth";
import { getDevices, getPrices } from "@/lib/device-cache";
import { getActivePriceList, getCategoryGrades } from "@/lib/categories";
import { calculatePartnerRate } from "@/lib/partner-pricing";

// ---------------------------------------------------------------------------
// GET /api/partner/prices?q=iPhone+15 — Price lookup for authenticated partner
// Returns matching devices with full grade pricing matrix
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requirePartner(request);
  if (result instanceof NextResponse) return result;
  const partner: PartnerSession = result;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (!query || query.length < 2) {
    return NextResponse.json({ devices: [], grades: [] });
  }

  try {
    const allDevices = await getDevices();

    // Filter active devices matching the search query against model or make+model
    const matched = allDevices.filter((d) => {
      if (!d.active) return false;
      const fullName = `${d.make} ${d.model}`.toLowerCase();
      return fullName.includes(query) || d.model.toLowerCase().includes(query);
    });

    if (matched.length === 0) {
      return NextResponse.json({ devices: [], grades: [] });
    }

    // Group by category to load the right price list for each
    const categories = Array.from(new Set(matched.map((d) => d.category)));
    const priceMaps = new Map<string, Map<string, Record<string, number>>>();
    let grades: { key: string; label: string }[] = [];

    for (const category of categories) {
      const priceListId = await getActivePriceList(category);
      if (priceListId) {
        const prices = await getPrices(priceListId);
        priceMaps.set(category, prices);
      }
      // Use grades from the first category (typically all Phone)
      if (grades.length === 0) {
        grades = await getCategoryGrades(category);
      }
    }

    const isModeB =
      partner.modes.includes("B") && partner.partnerRateDiscount != null;

    const devices = matched.map((d) => {
      const categoryPrices = priceMaps.get(d.category);
      const devicePrices = categoryPrices?.get(d.id) ?? {};

      // Apply partner discount for Mode B partners
      const adjustedGrades: Record<string, number | null> = {};
      for (const g of grades) {
        const raw = devicePrices[g.key] ?? null;
        if (raw == null) {
          adjustedGrades[g.key] = null;
        } else if (isModeB) {
          adjustedGrades[g.key] = calculatePartnerRate(
            raw,
            partner.partnerRateDiscount!
          );
        } else {
          adjustedGrades[g.key] = raw;
        }
      }

      return {
        make: d.make,
        model: d.model,
        storage: d.storage,
        category: d.category,
        grades: adjustedGrades,
      };
    });

    // Sort by make, model, storage
    devices.sort((a, b) => {
      if (a.make !== b.make) return a.make.localeCompare(b.make);
      if (a.model !== b.model) return a.model.localeCompare(b.model);
      return a.storage.localeCompare(b.storage);
    });

    return NextResponse.json({ devices: devices.slice(0, 5), grades });
  } catch (error) {
    console.error("Error fetching partner prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}
