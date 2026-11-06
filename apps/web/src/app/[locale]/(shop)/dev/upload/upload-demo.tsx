'use client';

import { useTranslations } from 'next-intl';
import { LoginGate } from '@/components/auth/login-gate';
import { MediaUploader } from '@/components/media/media-uploader';

export function UploadDemo() {
  const t = useTranslations('Dev');
  return (
    <LoginGate>
      {() => (
        <div className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-10 sm:py-14">
          <div>
            <h1 className="text-2xl font-bold text-text">{t('uploadTitle')}</h1>
            <p className="mt-1 text-sm text-muted">{t('uploadIntro')}</p>
          </div>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text">{t('productMedia')}</h2>
            <MediaUploader purpose="PRODUCT_MEDIA" />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text">{t('privateFile')}</h2>
            <MediaUploader purpose="PRIVATE_FILE" />
          </section>
        </div>
      )}
    </LoginGate>
  );
}
