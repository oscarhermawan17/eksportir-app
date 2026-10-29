import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { CatalogView } from './catalog-view';

export async function generateMetadata({ params }: PageProps<'/[locale]/products'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Catalog' });
  return { title: `${t('title')} — BaliTrade` };
}

// CatalogView reads the search parameters (?q=, ?category=, ?type=), which needs a Suspense boundary.
export default function ProductsPage() {
  return (
    <Suspense>
      <CatalogView />
    </Suspense>
  );
}
