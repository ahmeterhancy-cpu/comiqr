/**
 * Client-side image downscale + recompress before upload.
 *
 * Phone photos are routinely 3–8 MB — larger than PHP's upload_max_filesize on
 * most shared hosts (often 2 MB), so the raw file is rejected before it ever
 * reaches Laravel ("Görsel yüklenemedi."). Shrinking to a sane menu-photo size
 * (max ~1600px, JPEG q0.82) drops a typical photo to a few hundred KB — well
 * under any limit — and speeds up the customer menu. GIF/SVG (no bitmap or
 * animation we want to flatten) are returned untouched.
 */
export async function compressImage(
  file: File,
  {
    maxSize = 1600,
    quality = 0.82,
    maxBytes = 1_500_000,
    format = 'auto',
  }: { maxSize?: number; quality?: number; maxBytes?: number; format?: 'jpeg' | 'png' | 'auto' } = {},
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }
  // 'auto' keeps PNG sources as PNG so logos/graphics don't lose transparency;
  // everything else (photos) becomes JPEG for a much smaller file.
  const asPng = format === 'png' || (format === 'auto' && file.type === 'image/png');
  const outType = asPng ? 'image/png' : 'image/jpeg';
  const outExt = asPng ? '.png' : '.jpg';

  // Already small and within the dimension cap — no point re-encoding.
  if (file.size <= maxBytes) {
    try {
      const bmp = await createImageBitmap(file);
      const small = Math.max(bmp.width, bmp.height) <= maxSize;
      bmp.close();
      if (small) return file;
    } catch {
      return file; // undecodable here → let the server decide
    }
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, outType, asPng ? undefined : quality),
  );
  if (!blob) return file;

  const name = file.name.replace(/\.(png|webp|jpeg|jpg|heic|heif)$/i, '') + outExt;
  return new File([blob], name, { type: outType, lastModified: file.lastModified });
}
