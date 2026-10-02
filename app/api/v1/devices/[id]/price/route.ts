import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireApiKey, ApiKeyPartner, apiPartnerDiscount } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getActivePriceList, getCategoryGrades } from "@/lib/categories";
import { readGrades } from "@/lib/grades";
import { calculatePartnerRate } from "@/lib/partner-pricing";
import { getTodayFXRate, convertPrice } from "@/lib/fx";

// ---------------------------------------------------------------------------
// GET /api/v1/devices/[id]/price — Full grade pricing for one device
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    const deviceDoc = await adminDb.collection("devices").doc(id).get();
    if (!deviceDoc.exists) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const deviceData = deviceDoc.data()!;
    if (deviceData.active === false) {
      return NextResponse.json(
        { error: "Device is not available" },
        { status: 404 }
      );
    }

    const category = (deviceData.category as string) ?? "Phone";
    const categoryGrades = await getCategoryGrades(category);
    const priceListId = await getActivePriceList(category);

    if (!priceListId) {
      return NextResponse.json(
        { error: "No pricing available for this category" },
        { status: 404 }
      );
    }

    const priceDoc = await adminDb
      .doc(`priceLists/${priceListId}/prices/${id}`)
      .get();

    if (!priceDoc.exists) {
      return NextResponse.json(
        { error: "No pricing available for this device" },
        { status: 404 }
      );
    }

    const allGrades = readGrades(priceDoc.data()!);
    const discount = apiPartnerDiscount(partner);
    const currency = partner.currency ?? "NZD";
    const fxRates = currency !== "NZD" ? await getTodayFXRate() : null;
    const fxRate = fxRates?.NZD_AUD ?? 1;

    const grades: Record<string, { publicPriceNZD: number; partnerPriceNZD: number; publicPrice: number; partnerPrice: number } | null> = {};
    for (const g of categoryGrades) {
      const raw = allGrades[g.key];
      if (raw !== undefined && raw !== null) {
        const partnerNZD = calculatePartnerRate(raw, discount);
        grades[g.key] = {
          publicPriceNZD: raw,
          partnerPriceNZD: partnerNZD,
          publicPrice: convertPrice(raw, currency, fxRate),
          partnerPrice: convertPrice(partnerNZD, currency, fxRate),
        };
      } else {
        grades[g.key] = null;
      }
    }

    return NextResponse.json({
      id: deviceDoc.id,
      make: deviceData.make,
      model: deviceData.model,
      storage: deviceData.storage,
      category,
      grades,
      displayCurrency: currency,
    });
  } catch (error) {
    console.error("Error in v1 device price:", error);
    return NextResponse.json(
      { error: "Failed to fetch price" },
      { status: 500 }
    );
  }
}
