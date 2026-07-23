const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export async function resizeForUpload(blob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const resized = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    return resized ?? blob;
  } catch {
    return blob;
  }
}
