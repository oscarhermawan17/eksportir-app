import {
  isMediaContentType,
  looksLikeContentType,
  MAGIC_BYTES_HEAD,
  maxBytesFor,
  mediaKindOf,
  type MediaKind,
  type MediaPurpose,
  type PresignedDownload,
  type PresignedUpload,
  type PresignUploadRequest,
} from '@balitrade/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { compressImage } from '@/lib/image-compress';

export type MediaValidationError = 'type' | 'size' | 'content';

/**
 * Reasons uploadMedia refuses a file, carried in ApiError.messages so the uploader can name the actual
 * problem instead of "upload failed".
 */
export const UPLOAD_REFUSED = {
  /** The bytes are not the format the file claims to be. */
  content: 'MEDIA_CONTENT_MISMATCH',
  /** A photo that is still over the limit after the browser compressed it as far as it goes. */
  imageTooLarge: 'MEDIA_IMAGE_TOO_LARGE',
  type: 'MEDIA_TYPE_NOT_ALLOWED',
} as const;

/**
 * Checks the declared type before anything else happens (the API and the storage check again). Size is
 * deliberately NOT checked here for images: the browser compresses them first, so the only size that
 * matters is the one after that — see uploadMedia.
 */
export function validateMediaFile(file: File): MediaValidationError | null {
  if (!isMediaContentType(file.type)) {
    return 'type';
  }
  if (file.size === 0) return 'size';
  return mediaKindOf(file.type) === 'VIDEO' && file.size > maxBytesFor(file.type) ? 'size' : null;
}

/**
 * Reads the first bytes and checks they really are the format the file claims. A browser sets
 * `File.type` from the extension, so a renamed `.exe` arrives as `image/jpeg` without this.
 *
 * It is a second layer, not the only one: the content type is pinned into the upload signature, so even
 * a file that got past this could never be served as HTML or a script.
 */
export async function hasMatchingContent(file: File): Promise<boolean> {
  if (!isMediaContentType(file.type)) return false;
  const head = new Uint8Array(await file.slice(0, MAGIC_BYTES_HEAD).arrayBuffer());
  return looksLikeContentType(head, file.type);
}

export interface UploadedMedia {
  key: string;
  kind: MediaKind;
  /** Permanent URL for product media; null for private files. */
  publicUrl: string | null;
}

/**
 * Uploads a file straight to R2: ask the API for a presigned URL, then PUT the bytes to it.
 * `onProgress` receives 0–1. Throws ApiError (API problems) or ApiError(0|status) for storage errors.
 */
export async function uploadMedia(
  original: File,
  purpose: MediaPurpose,
  onProgress?: (fraction: number) => void,
): Promise<UploadedMedia> {
  const problem = validateMediaFile(original);
  if (problem || !isMediaContentType(original.type)) {
    throw new ApiError(400, [UPLOAD_REFUSED.type]);
  }
  if (!(await hasMatchingContent(original))) {
    throw new ApiError(400, [UPLOAD_REFUSED.content]);
  }

  // Images are resized and re-encoded first, so the signed size is the final one. A photo that still
  // does not fit after that is genuinely unusable, and saying so beats uploading something broken.
  const file = mediaKindOf(original.type) === 'IMAGE' ? await compressImage(original) : original;
  if (!isMediaContentType(file.type) || file.size > maxBytesFor(file.type)) {
    throw new ApiError(400, [UPLOAD_REFUSED.imageTooLarge]);
  }

  const body: PresignUploadRequest = { purpose, contentType: file.type, size: file.size };
  const presigned = await apiFetch<PresignedUpload>('/media/presign-upload', { method: 'POST', body });

  await putFile(presigned, file, onProgress);
  return { key: presigned.key, kind: mediaKindOf(file.type), publicUrl: presigned.publicUrl };
}

/** Short-lived link to open a private file you own. */
export function getPrivateFileUrl(key: string): Promise<PresignedDownload> {
  return apiFetch<PresignedDownload>(`/media/download-url?key=${encodeURIComponent(key)}`);
}

// XMLHttpRequest instead of fetch because fetch cannot report upload progress.
function putFile(presigned: PresignedUpload, file: File, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presigned.uploadUrl);
    for (const [name, value] of Object.entries(presigned.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new ApiError(xhr.status === 403 ? 502 : xhr.status, ['Storage rejected the file']));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, ['Network error']));
    xhr.send(file);
  });
}
