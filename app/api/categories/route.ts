import { NextRequest, NextResponse } from "next/server";
import { loadCategories } from "@/lib/categories";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// GET /api/categories — Public endpoint to list categories with grade info
// Used by consumer pages to render grade selectors
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`ip:${ip}:/api/categories`, 20);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const categories = await loadCategories();

    // Return only names and grades (no activePriceList — that's admin-only)
    const publicCategories = categories.map((c) => ({
      name: c.name,
      grades: c.grades,
    }));

    return NextResponse.json(publicCategories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
