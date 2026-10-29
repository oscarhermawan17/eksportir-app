import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ProductDetail } from './product-detail';

export async function generateMetadata({ params }: PageProps<'/[locale]/products/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Catalog' });
  return { title: `${t('title')} — BaliTrade` };
}

async function DetailContent({ params }: { params: PageProps<'/[locale]/products/[id]'>['params'] }) {
  const { id } = await params;
  return <ProductDetail id={id} />;
}

// The product id is only known per request, so it is read inside a Suspense boundary.
export default function ProductPage({ params }: PageProps<'/[locale]/products/[id]'>) {
  return (
    <Suspense>
      <DetailContent params={params} />
    </Suspense>
  );
}
