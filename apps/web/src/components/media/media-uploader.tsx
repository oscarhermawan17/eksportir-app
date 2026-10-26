'use client';

import type { MediaPurpose } from '@balitrade/shared';
import { maxBytesFor, MEDIA_CONTENT_TYPES, type MediaContentType } from '@balitrade/shared';
import { Film, Loader2, Lock, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type ChangeEvent } from 'react';
import { ApiError, errorKey } from '@/lib/api';
import { getPrivateFileUrl, uploadMedia, validateMediaFile, type UploadedMedia } from '@/lib/media';

interface Item {
  id: number;
  name: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  message?: string;
  media?: UploadedMedia;
  /** Local preview of what was picked (object URL) — no extra download needed. */
  previewUrl: string;
  isVideo: boolean;
}

let nextId = 1;

/** Pick files, upload them to R2 with progress, show a preview. Reused by the product form (T09). */
export function MediaUploader({
  purpose,
  initialMedia = [],
  onUploaded,
  onRemoved,
}: {
  purpose: MediaPurpose;
  /** Files that were uploaded earlier (e.g. when editing a product); shown like finished uploads. */
  initialMedia?: UploadedMedia[];
  onUploaded?: (media: UploadedMedia) => void;
  onRemoved?: (media: UploadedMedia) => void;
}) {
  const t = useTranslations('Media');
  const tErrors = useTranslations('Errors');
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>(() =>
    initialMedia.map((media) => ({
      id: nextId++,
      name: media.key.split('/').pop() ?? media.key,
      status: 'done' as const,
      progress: 1,
      media,
      previewUrl: media.publicUrl ?? '',
      isVideo: media.kind === 'VIDEO',
    })),
  );

  const update = (id: number, patch: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  function explain(error: unknown): string {
    if (error instanceof ApiError && error.status === 403 && purpose === 'PRODUCT_MEDIA') {
      return t('forbiddenProduct');
    }
    if (error instanceof ApiError && error.status === 502) {
      return t('storageRejected');
    }
    if (error instanceof ApiError && error.status === 503) {
      return t('unavailable');
    }
    return tErrors(errorKey(error));
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ''; // allow picking the same file again
    for (const file of files) {
      const id = nextId++;
      const problem = validateMediaFile(file);
      const item: Item = {
        id,
        name: file.name,
        status: problem ? 'error' : 'uploading',
        progress: 0,
        previewUrl: URL.createObjectURL(file),
        isVideo: file.type.startsWith('video/'),
        message: problem
          ? problem === 'type'
            ? t('typeNotAllowed', { name: file.name })
            : t('tooLarge', {
                name: file.name,
                max: Math.round(maxBytesFor(file.type as MediaContentType) / (1024 * 1024)),
              })
          : undefined,
      };
      setItems((current) => [...current, item]);
      if (problem) {
        continue;
      }
      try {
        const media = await uploadMedia(file, purpose, (progress) => update(id, { progress }));
        update(id, { status: 'done', progress: 1, media });
        onUploaded?.(media);
      } catch (error) {
        console.error('Upload failed', error);
        update(id, { status: 'error', message: explain(error) });
      }
    }
  }

  function remove(item: Item) {
    if (item.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.previewUrl);
    }
    setItems((current) => current.filter((other) => other.id !== item.id));
    if (item.media) {
      onRemoved?.(item.media);
    }
  }

  async function openPrivate(key: string) {
    try {
      const { url } = await getPrivateFileUrl(key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Could not open file', error);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={MEDIA_CONTENT_TYPES.join(',')}
        onChange={onPick}
        className="sr-only"
        id={`media-${purpose}`}
      />
      <label
        htmlFor={`media-${purpose}`}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-card border-2 border-dashed border-border bg-card px-4 py-8 text-center transition focus-within:border-primary hover:border-primary"
      >
        <Upload className="h-6 w-6 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold text-primary">{t('choose')}</span>
        <span className="text-xs text-muted">{t('hint')}</span>
      </label>

      {items.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 rounded-card border border-border bg-card p-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-button bg-background">
                {item.isVideo ? (
                  <Film className="h-6 w-6 text-muted" aria-hidden="true" />
                ) : purpose === 'PRIVATE_FILE' || !item.previewUrl ? (
                  <Lock className="h-6 w-6 text-muted" aria-hidden="true" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not optimizable
                  <img src={item.previewUrl} alt={t('previewAlt')} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-text" title={item.name}>
                  {item.name}
                </p>
                {item.status === 'uploading' ? (
                  <div className="mt-1" role="status">
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      {t('uploading')} {Math.round(item.progress * 100)}%
                    </p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full bg-primary transition-all" style={{ width: `${item.progress * 100}%` }} />
                    </div>
                  </div>
                ) : null}
                {item.status === 'done' ? (
                  <p className="mt-1 text-xs font-semibold text-success">
                    {t('done')}
                    {item.media && item.media.publicUrl === null ? (
                      <button
                        type="button"
                        onClick={() => void openPrivate(item.media!.key)}
                        className="ml-2 font-semibold text-primary underline"
                      >
                        {t('openFile')}
                      </button>
                    ) : item.media?.publicUrl ? (
                      <a
                        href={item.media.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 font-semibold text-primary underline"
                      >
                        {t('openFile')}
                      </a>
                    ) : null}
                  </p>
                ) : null}
                {item.status === 'error' ? (
                  <p role="alert" className="mt-1 text-xs text-error">
                    {item.message ?? t('failed')}
                  </p>
                ) : null}
              </div>
              {item.status !== 'uploading' ? (
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label={t('remove')}
                  className="self-start rounded-button p-1 text-muted hover:bg-background hover:text-text"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
