import { NextRequest, NextResponse } from "next/server";
import { requireApiKey, ApiKeyPartner } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDevices, getPrices } from "@/lib/device-cache";
import { getActivePriceList, getCategoryGrades, loadCategories } from "@/lib/categories";
import { calculatePartnerRate } from "@/lib/partner-pricing";
import { getTodayFXRate, convertPrice } from "@/lib/fx";

// ---------------------------------------------------------------------------
// GET /api/v1/devices — Search/list devices with partner pricing
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Auth
  const result = await requireApiKey(request);
  if (result instanceof NextResponse) return result;
  const partner: ApiKeyPartner = result;

  // Rate limit
  const rl = await checkRateLimit(partner.apiKeyId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const makeFilter = searchParams.get("make")?.trim().toLowerCase() ?? "";
    const categoryFilter = searchParams.get("category")?.trim() ?? "";
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50), 200);
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    const allDevices = await getDevices();

    // Filter active devices
    let matched = allDevices.filter((d) => {
      if (!d.active) return false;
      if (makeFilter && d.make.toLowerCase() !== makeFilter) return false;
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (query && query.length >= 2) {
        const fullName = `${d.make} ${d.model}`.toLowerCase();
        if (!fullName.includes(query) && !d.model.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });

    // Sort by make, model, storage
    matched.sort((a, b) => {
      if (a.make !== b.make) return a.make.localeCompare(b.make);
      if (a.model !== b.model) return a.model.localeCompare(b.model);
      return a.storage.localeCompare(b.storage);
    });

    const total = matched.length;
    const paged = matched.slice(offset, offset + limit);

    // Load prices for all relevant categories
    const categories = Array.from(new Set(paged.map((d) => d.category)));
    const priceMaps = new Map<string, Map<string, Record<string, number>>>();
    let grades: { key: string; label: string }[] = [];

    for (const category of categories) {
      const priceListId = await getActivePriceList(category);
      if (priceListId) {
        const prices = await getPrices(priceListId);
        priceMaps.set(category, prices);
      }
      if (grades.length === 0) {
        grades = await getCategoryGrades(category);
      }
    }

    const discount = partner.partnerRateDiscount ?? 10;
    const currency = partner.currency ?? "NZD";
    const fxRates = currency !== "NZD" ? await getTodayFXRate() : null;
    const fxRate = fxRates?.NZD_AUD ?? 1;

    const devices = paged.map((d) => {
      const categoryPrices = priceMaps.get(d.category);
      const devicePrices = categoryPrices?.get(d.id) ?? {};

      const adjustedGrades: Record<string, { partnerPriceNZD: number; partnerPrice: number } | null> = {};
      for (const g of grades) {
        const raw = devicePrices[g.key] ?? null;
        if (raw != null) {
          const partnerNZD = calculatePartnerRate(raw, discount);
          adjustedGrades[g.key] = {
            partnerPriceNZD: partnerNZD,
            partnerPrice: convertPrice(partnerNZD, currency, fxRate),
          };
        } else {
          adjustedGrades[g.key] = null;
        }
      }

      return {
        id: d.id,
        make: d.make,
        model: d.model,
        storage: d.storage,
        category: d.category,
        grades: adjustedGrades,
      };
    });

    return NextResponse.json({ devices, grades, total, limit, offset, displayCurrency: currency });
  } catch (error) {
    console.error("Error in v1 devices:", error);
    return NextResponse.json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    );
  }
}
