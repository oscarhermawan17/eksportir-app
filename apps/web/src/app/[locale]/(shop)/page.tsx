import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { CatalogView } from '@/components/catalog/catalog-view';
import { Link } from '@/i18n/navigation';

const LINK =
  'rounded-sm font-medium text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * The landing page is the catalog: visitors should see what is for sale, not a brochure.
 * A short introduction says what BaliTrade is in one sentence and stays low enough that the first row of
 * products is still on the first screen; everything explanatory lives on /how-it-works.
 */
export default function Home() {
  const t = useTranslations('Home');

  return (
    <>
      <section className="border-b border-border">
        <div className="page-container flex flex-col gap-4 py-8 sm:py-10 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl">{t('title')}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted">{t('lead')}</p>
          </div>
          <div className="flex shrink-0 gap-6 text-sm">
            <Link href="/how-it-works" className={LINK}>
              {t('howItWorksLink')}
            </Link>
            <Link href="/register?role=seller" className={LINK}>
              {t('sellLink')}
            </Link>
          </div>
        </div>
      </section>

      {/* CatalogView reads the search parameters (?q=, ?category=, ?type=), which needs a Suspense boundary. */}
      <Suspense>
        <CatalogView />
      </Suspense>
    </>
  );
}
