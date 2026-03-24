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

/**
 * Derive a static hero image path from a model name.
 * Maps to files in /public/devices/ (served as /devices/...).
 * e.g. toModelImagePath("iPhone 12 Pro") → "/devices/iphone-12-pro.jpg"
 *      toModelImagePath("iPhone SE (2020)") → "/devices/iphone-se-2020.jpg"
 */
export function toModelImagePath(model: string): string {
  const slug = model
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `/devices/${slug}.jpg`;
}
