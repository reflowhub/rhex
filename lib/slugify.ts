/**
 * Generate a URL-safe slug from make + model.
 * e.g. toModelSlug("Apple", "iPhone 12") → "apple-iphone-12"
 */
export function toModelSlug(make: string, model: string): string {
  return `${make} ${model}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
