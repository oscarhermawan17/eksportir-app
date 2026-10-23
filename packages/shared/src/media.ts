/** What an upload is for. Decides who may upload, the storage location and who may read the file. */
export const MEDIA_PURPOSES = ['PRODUCT_MEDIA', 'PRIVATE_FILE'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const MEDIA_CONTENT_TYPES = [...IMAGE_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES] as const;
export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];

export type MediaKind = 'IMAGE' | 'VIDEO';

/** Size limits (ARCHITECTURE §Media): photo ≤ 10 MB, video ≤ 50 MB. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

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
