import { NextRequest, NextResponse } from "next/server";
import { indexDb } from "@/lib/index-supabase";

const SOURCES = ["vodafone_au_tradein", "telstra_au_tradein"] as const;

const SOURCE_DISPLAY: Record<string, string> = {
  vodafone_au_tradein: "Vodafone",
  telstra_au_tradein: "Telstra",
};

/**
 * Map rhex grade to the competitor grade to compare against.
 * Vodafone and Telstra only have B (Good) and D (Damaged) grades.
 *   rhex A or B → competitor B
 *   rhex C or D → competitor D
 *   rhex E → no comparison
 */
function mapToCompetitorGrade(rhexGrade: string): string | null {
  switch (rhexGrade.toUpperCase()) {
    case "A":
    case "B":
      return "B";
    case "C":
    case "D":
      return "D";
    default:
      return null;
  }
}

// GET /api/competitor-prices?make=Apple&model=iPhone+15+Pro&storage=256GB&grade=A&rhexPrice=500
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const storage = searchParams.get("storage");
    const grade = searchParams.get("grade");
    const rhexPriceStr = searchParams.get("rhexPrice");

    if (!make || !model || !storage || !grade || !rhexPriceStr) {
      return NextResponse.json(
        { error: "make, model, storage, grade, and rhexPrice are required" },
        { status: 400 }
      );
    }

    const rhexPrice = parseFloat(rhexPriceStr);
    if (isNaN(rhexPrice)) {
      return NextResponse.json(
        { error: "rhexPrice must be a number" },
        { status: 400 }
      );
    }

    const competitorGrade = mapToCompetitorGrade(grade);
    if (!competitorGrade) {
      return NextResponse.json({ competitors: [] });
    }

    // Index stores model_storage as "Model Storage" (e.g. "iPhone 15 Pro 256GB")
    const modelStorage = `${model} ${storage}`;

    // Get latest completed run ID for each source
    const { data: runs, error: runsError } = await indexDb
      .from("scrape_runs")
      .select("id, scrape_sources!inner(name)")
      .eq("status", "completed")
      .order("scraped_at", { ascending: false });

    if (runsError) {
      console.error("Error fetching scrape runs:", runsError);
      return NextResponse.json({ competitors: [] });
    }

    const latestRunIds: Record<string, string> = {};
    for (const run of runs ?? []) {
      const sourceName = (run.scrape_sources as unknown as { name: string })
        .name;
      if (SOURCES.includes(sourceName as (typeof SOURCES)[number]) && !latestRunIds[sourceName]) {
        latestRunIds[sourceName] = run.id;
      }
    }

    const runIds = Object.values(latestRunIds);
    if (runIds.length === 0) {
      return NextResponse.json({ competitors: [] });
    }

    // Query competitor prices for this device + grade
    const { data: prices, error: pricesError } = await indexDb
      .from("scraped_prices")
      .select("source_name, price, grade_normalized")
      .in("run_id", runIds)
      .in("source_name", [...SOURCES])
      .eq("make", make)
      .eq("model_storage", modelStorage)
      .eq("grade_normalized", competitorGrade);

    if (pricesError) {
      console.error("Error fetching competitor prices:", pricesError);
      return NextResponse.json({ competitors: [] });
    }

    // Filter: only include competitors where rhex price is higher
    const competitors = (prices ?? [])
      .filter((p) => p.price < rhexPrice)
      .map((p) => ({
        name: SOURCE_DISPLAY[p.source_name] ?? p.source_name,
        price: p.price,
        grade: p.grade_normalized,
      }));

    return NextResponse.json({ competitors });
  } catch (error) {
    console.error("Error in competitor-prices:", error);
    return NextResponse.json({ competitors: [] });
  }
}
