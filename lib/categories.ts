import { adminDb } from "@/lib/firebase-admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryGrade {
  key: string;
  label: string;
}

export interface Category {
  name: string;
  grades: CategoryGrade[];
  activePriceList: string | null;
}

// ---------------------------------------------------------------------------
// Cache (60s TTL for server-side use)
// ---------------------------------------------------------------------------

let cachedCategories: Category[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export async function loadCategories(): Promise<Category[]> {
  if (cachedCategories && Date.now() - cacheTime < CACHE_TTL) {
    return cachedCategories;
  }

  const doc = await adminDb.doc("settings/categories").get();
  if (!doc.exists) {
    cachedCategories = [];
    cacheTime = Date.now();
    return [];
  }

  const data = doc.data()!;
  const categories: Category[] = [];

  for (const [name, value] of Object.entries(data)) {
    const cat = value as Record<string, unknown>;
    const grades = (cat.grades as CategoryGrade[]) ?? [];
    const activePriceList = (cat.activePriceList as string) ?? null;
    categories.push({ name, grades, activePriceList });
  }

  categories.sort((a, b) => a.name.localeCompare(b.name));
  cachedCategories = categories;
  cacheTime = Date.now();
  return categories;
}

export async function getActivePriceList(
  category: string
): Promise<string | null> {
  const categories = await loadCategories();
  const cat = categories.find((c) => c.name === category);
  return cat?.activePriceList ?? null;
}

export async function getCategoryGrades(
  category: string
): Promise<CategoryGrade[]> {
  const categories = await loadCategories();
  const cat = categories.find((c) => c.name === category);
  return cat?.grades ?? [];
}

/** Bust the cache (e.g. after updating categories document) */
export function invalidateCategoriesCache(): void {
  cachedCategories = null;
  cacheTime = 0;
}
