import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ProductReview } from './product-review';

type Props = PageProps<'/[locale]/admin/products/[id]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminProducts' });
  return { title: `${t('title')} — BaliTrade` };
}

async function Content({ params }: { params: Props['params'] }) {
  const { id } = await params;
  return <ProductReview id={id} />;
}

// The product id is only known per request, so it is read inside a Suspense boundary.
export default function AdminProductPage({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
