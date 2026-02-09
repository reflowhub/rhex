import { NextRequest, NextResponse } from "next/server";
import { getTodayFXRate } from "@/lib/fx";

// GET /api/fx — Get current FX rates + geo country
export async function GET(request: NextRequest) {
  try {
    const rates = await getTodayFXRate();
    // Vercel provides x-vercel-ip-country automatically on deployed requests
    const country = request.headers.get("x-vercel-ip-country") || null;
    return NextResponse.json({ ...rates, country });
  } catch (error) {
    console.error("Error fetching FX rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch FX rates" },
      { status: 500 }
    );
  }
}
