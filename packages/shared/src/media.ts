/** What an upload is for. Decides who may upload, the storage location and who may read the file. */
export const MEDIA_PURPOSES = ['PRODUCT_MEDIA', 'PRIVATE_FILE'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const MEDIA_CONTENT_TYPES = [...IMAGE_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES] as const;
export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];

export type MediaKind = 'IMAGE' | 'VIDEO';

/**
 * Size limits (ARCHITECTURE §Media), tightened for images on 2026-11-12 at the owner's request.
 *
 * 500 KB is far below what a phone camera produces (2–5 MB), so it is only workable because the browser
 * resizes and re-encodes before uploading — see IMAGE_COMPRESSION. Without that, nearly every real photo
 * would be rejected. The API and the presigned URL check the final size, not the original.
 *
 * Why 500 KB and not 1 MB (owner's question, 2026-11-12): at 2000 px a heavily textured photo — woven
 * rattan, batik, leather grain — lands at 300–450 KB, so 500 KB is already enough that such a photo is
 * never degraded. The ceiling that actually matters is the catalog page: the web app uses plain <img>
 * with no thumbnails and no srcset, so one file serves both the grid card and the detail view, and a
 * grid of twelve products downloads twelve full-size files. 500 KB makes that ~6 MB; 1 MB would make it
 * ~12 MB, which is painful on the mobile connections both sides of this marketplace actually use.
 * Raising it further only makes sense together with stored thumbnails.
 */
export const MAX_IMAGE_BYTES = 500 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/**
 * What the browser does to a photo before asking for an upload URL. Longest side first, then quality,
 * each step re-encoded to WebP and measured; the first result under MAX_IMAGE_BYTES wins.
 */
export const IMAGE_COMPRESSION = {
  /**
   * The first entry is also the cap every photo is normalised to, whatever its file size: a buyer
   * judging the weave of a basket wants pixels, and 2000 px is a useful amount of them.
   */
  maxDimensions: [2000, 1600, 1280] as const,
  qualities: [0.85, 0.78, 0.7] as const,
  outputType: 'image/webp' as const,
} as const;

/**
 * First bytes of each accepted format. The Content-Type is already pinned into the upload signature, so
 * this is a second layer: it stops a file that merely claims to be an image (a renamed .exe, an HTML
 * page) from reaching the bucket at all. WebP and MP4 are container formats, so their marker sits at a
 * fixed offset rather than at byte 0.
 */
export const MEDIA_MAGIC_BYTES: { type: MediaContentType; offset: number; bytes: number[] }[] = [
  { type: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // "RIFF" .... "WEBP"
  { type: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  { type: 'image/webp', offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  // "ftyp" at offset 4 covers MP4 and QuickTime alike; the brand that follows differs per encoder.
  { type: 'video/mp4', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  { type: 'video/quicktime', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  // EBML header, shared by WebM and Matroska.
  { type: 'video/webm', offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
];

/**
 * True when `head` (the first bytes of a file) really is the format it claims to be. Every signature
 * registered for that type must match, which is what makes the two-part WebP check meaningful.
 */
export function looksLikeContentType(head: Uint8Array, type: MediaContentType): boolean {
  const signatures = MEDIA_MAGIC_BYTES.filter((entry) => entry.type === type);
  if (signatures.length === 0) return false;
  return signatures.every(({ offset, bytes }) =>
    bytes.every((byte, index) => head[offset + index] === byte),
  );
}

/** How many bytes of a file need reading for looksLikeContentType. */
export const MAGIC_BYTES_HEAD = 16;

export function isMediaContentType(value: string): value is MediaContentType {
  return (MEDIA_CONTENT_TYPES as readonly string[]).includes(value);
}

export function mediaKindOf(contentType: MediaContentType): MediaKind {
  return (VIDEO_CONTENT_TYPES as readonly string[]).includes(contentType) ? 'VIDEO' : 'IMAGE';
}

export function maxBytesFor(contentType: MediaContentType): number {
  return mediaKindOf(contentType) === 'VIDEO' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

/** Body of POST /api/media/presign-upload. */
export interface PresignUploadRequest {
  purpose: MediaPurpose;
  contentType: MediaContentType;
  /** Exact file size in bytes; the upload URL only accepts a body of this size. */
  size: number;
}

/** Response of POST /api/media/presign-upload: PUT the file to `uploadUrl` with `headers`. */
export interface PresignedUpload {
  /** Storage key to save (e.g. in ProductMedia.r2Key). */
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
  /** Permanent URL for PRODUCT_MEDIA; null for private files (use GET /api/media/download-url). */
  publicUrl: string | null;
  expiresInSeconds: number;
}

/** Response of GET /api/media/download-url. */
export interface PresignedDownload {
  url: string;
  expiresInSeconds: number;
}
