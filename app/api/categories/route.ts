import { NextResponse } from "next/server";
import { loadCategories } from "@/lib/categories";

// ---------------------------------------------------------------------------
// GET /api/categories — Public endpoint to list categories with grade info
// Used by consumer pages to render grade selectors
// ---------------------------------------------------------------------------

export async function GET() {
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
