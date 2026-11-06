import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { SellerPage } from './seller-page';

export async function generateMetadata({ params }: PageProps<'/[locale]/sellers/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Catalog' });
  return { title: `${t('seller')} — BaliTrade` };
}

async function SellerContent({ params }: { params: PageProps<'/[locale]/sellers/[id]'>['params'] }) {
  const { id } = await params;
  return <SellerPage id={id} />;
}

// The seller id is only known per request, so it is read inside a Suspense boundary.
export default function PublicSellerPage({ params }: PageProps<'/[locale]/sellers/[id]'>) {
  return (
    <Suspense>
      <SellerContent params={params} />
    </Suspense>
  );
}
