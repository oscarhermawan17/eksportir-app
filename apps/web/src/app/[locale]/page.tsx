import { useTranslations } from 'next-intl';
import { DEFAULT_LOCALE, LOCALES } from '@balitrade/shared';

// Placeholder home page. The real landing page follows TASKS.md.
export default function Home() {
  const t = useTranslations('Home');
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <p className="text-sm font-semibold uppercase tracking-wider text-gold-text">{t('eyebrow')}</p>
      <h1 className="text-4xl font-bold tracking-tight text-primary">{t('title')}</h1>
      <p className="text-lg text-muted">{t('intro')}</p>
      <div className="rounded-card border border-border bg-card p-5 text-sm">
        <p>
          Languages: {LOCALES.join(', ')} (default: {DEFAULT_LOCALE})
        </p>
      </div>
    </section>
  );
}
