import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { CatalogView } from '@/components/catalog/catalog-view';
import { Link } from '@/i18n/navigation';

const CHECKS = ['qc', 'payment', 'cargo'] as const;

/**
 * The landing page is the catalog: visitors should see what is for sale, not a brochure.
 * Everything explanatory lives on /how-it-works, reached from the thin band below and the footer.
 */
export default function Home() {
  const t = useTranslations('Home');

  return (
    <>
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 text-sm">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {CHECKS.map((key) => (
              <li key={key} className="flex items-center gap-1.5 text-text">
                <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {t(`checks.${key}`)}
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-5">
            <Link href="/how-it-works" className="font-semibold text-primary hover:underline">
              {t('howItWorksLink')}
            </Link>
            <Link href="/register?role=seller" className="font-semibold text-primary hover:underline">
              {t('sellLink')}
            </Link>
          </div>
        </div>
      </div>

      {/* CatalogView reads the search parameters (?q=, ?category=, ?type=), which needs a Suspense boundary. */}
      <Suspense>
        <CatalogView />
      </Suspense>
    </>
  );
}
