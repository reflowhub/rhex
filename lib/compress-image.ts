/**
 * Compress an image file using canvas.
 * Resizes to maxDimension and compresses as JPEG.
 * Returns a new File under the target size.
 */
export async function compressImage(
  file: File,
  maxDimension = 1200,
  maxSizeBytes = 900 * 1024,
  quality = 0.8
): Promise<File> {
  // If already small enough, return as-is
  if (file.size <= maxSizeBytes) return file;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Scale down to fit within maxDimension
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Try progressively lower quality until under size limit
  let blob: Blob;
  let q = quality;
  do {
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: q });
    q -= 0.1;
  } while (blob.size > maxSizeBytes && q > 0.3);

  const name = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([blob], name, { type: "image/jpeg" });
}
