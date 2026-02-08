import { NextResponse } from "next/server";
import { getTodayFXRate } from "@/lib/fx";

// GET /api/fx — Get current FX rates
export async function GET() {
  try {
    const rates = await getTodayFXRate();
    return NextResponse.json(rates);
  } catch (error) {
    console.error("Error fetching FX rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch FX rates" },
      { status: 500 }
    );
  }
}
