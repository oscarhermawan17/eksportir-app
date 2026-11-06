import { useTranslations } from 'next-intl';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/** Shared by the shop and the app-level 404 boundaries, which differ only in the chrome around them. */
export function NotFoundView() {
  const t = useTranslations('NotFound');
  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-5xl font-bold text-gold-text">404</p>
      <h1 className="text-2xl font-bold text-text">{t('title')}</h1>
      <p className="text-muted">{t('text')}</p>
      <Link href="/" className={buttonClasses('primary')}>
        {t('home')}
      </Link>
    </section>
  );
}
