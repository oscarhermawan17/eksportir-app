import {
  isMediaContentType,
  maxBytesFor,
  mediaKindOf,
  type MediaKind,
  type MediaPurpose,
  type PresignedDownload,
  type PresignedUpload,
  type PresignUploadRequest,
} from '@balitrade/shared';
import { ApiError, apiFetch } from '@/lib/api';

export type MediaValidationError = 'type' | 'size';

/** Checks type and size before asking the API for an upload URL (the API and storage check again). */
export function validateMediaFile(file: File): MediaValidationError | null {
  if (!isMediaContentType(file.type)) {
    return 'type';
  }
  return file.size > maxBytesFor(file.type) || file.size === 0 ? 'size' : null;
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
  file: File,
  purpose: MediaPurpose,
  onProgress?: (fraction: number) => void,
): Promise<UploadedMedia> {
  const problem = validateMediaFile(file);
  if (problem || !isMediaContentType(file.type)) {
    throw new ApiError(400, ['Unsupported file']);
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
