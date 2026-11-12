import { IMAGE_COMPRESSION, MAX_IMAGE_BYTES } from '@balitrade/shared';

/**
 * Shrinks a photo in the browser until it fits MAX_IMAGE_BYTES (200 KB).
 *
 * This is what makes that limit usable at all: a phone camera produces 2–5 MB, so without this step a
 * seller would be told "too big" for almost every photo they own, with no way to fix it on a phone. The
 * file that leaves here is the one the upload URL is signed for, so the size the API sees is the final
 * one — the original is never sent anywhere.
 *
 * Tries each dimension at each quality, largest and best first, and takes the first result that fits.
 */
export async function compressImage(file: File): Promise<File> {
  // Already small enough: leave it exactly as it is rather than re-encoding and losing quality for nothing.
  if (file.size <= MAX_IMAGE_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  try {
    for (const maxDimension of IMAGE_COMPRESSION.maxDimensions) {
      const { width, height } = fit(bitmap.width, bitmap.height, maxDimension);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) break;
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of IMAGE_COMPRESSION.qualities) {
        const blob = await toBlob(canvas, IMAGE_COMPRESSION.outputType, quality);
        if (blob && blob.size <= MAX_IMAGE_BYTES) {
          return new File([blob], renameTo(file.name, 'webp'), { type: IMAGE_COMPRESSION.outputType });
        }
      }
    }
  } finally {
    bitmap.close();
  }

  // Nothing fit — the caller reports it. Returning the original keeps the error about size, not about
  // some half-compressed file the seller never chose.
  return file;
}

/** Scales to fit inside a square of `max`, never enlarging a photo that is already smaller. */
function fit(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const ratio = max / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function renameTo(name: string, extension: string): string {
  return `${name.replace(/\.[^.]+$/, '')}.${extension}`;
}
