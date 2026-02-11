import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidateCategoriesCache } from "@/lib/categories";

// ---------------------------------------------------------------------------
// GET /api/admin/categories — List all categories
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const doc = await adminDb.doc("settings/categories").get();
    if (!doc.exists) {
      return NextResponse.json({ categories: {} });
    }

    return NextResponse.json({ categories: doc.data() });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/categories — Update categories document
// Body: { categories: { Phone: { grades: [...], activePriceList: "..." }, ... } }
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    if (adminUser instanceof NextResponse) return adminUser;

    const body = await request.json();
    const { categories } = body;

    if (!categories || typeof categories !== "object") {
      return NextResponse.json(
        { error: "categories object is required" },
        { status: 400 }
      );
    }

    // Validate each category
    for (const [name, value] of Object.entries(categories)) {
      const cat = value as Record<string, unknown>;

      if (!name || typeof name !== "string") {
        return NextResponse.json(
          { error: "Category name must be a non-empty string" },
          { status: 400 }
        );
      }

      if (!Array.isArray(cat.grades) || cat.grades.length === 0) {
        return NextResponse.json(
          { error: `Category "${name}" must have at least one grade` },
          { status: 400 }
        );
      }

      for (const grade of cat.grades as Record<string, unknown>[]) {
        if (!grade.key || typeof grade.key !== "string") {
          return NextResponse.json(
            {
              error: `Category "${name}" has a grade with missing or invalid key`,
            },
            { status: 400 }
          );
        }
        if (!grade.label || typeof grade.label !== "string") {
          return NextResponse.json(
            {
              error: `Category "${name}" grade "${grade.key}" has missing or invalid label`,
            },
            { status: 400 }
          );
        }
      }
    }

    await adminDb.doc("settings/categories").set(categories);
    invalidateCategoriesCache();

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error updating categories:", error);
    return NextResponse.json(
      { error: "Failed to update categories" },
      { status: 500 }
    );
  }
}
