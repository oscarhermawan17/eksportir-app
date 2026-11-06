import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { EditProduct } from '../../product-pages';

export async function generateMetadata({ params }: PageProps<'/[locale]/seller/products/[id]/edit'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Products' });
  return { title: `${t('editTitle')} — BaliTrade` };
}

async function EditContent({ params }: { params: PageProps<'/[locale]/seller/products/[id]/edit'>['params'] }) {
  const { id } = await params;
  return <EditProduct id={id} />;
}

// The product id is only known per request, so it is read inside a Suspense boundary.
export default function EditProductPage({ params }: PageProps<'/[locale]/seller/products/[id]/edit'>) {
  return (
    <Suspense>
      <EditContent params={params} />
    </Suspense>
  );
}
