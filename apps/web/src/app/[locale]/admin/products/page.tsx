import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductsReview } from './products-review';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/products'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminProducts' });
  return { title: `${t('title')} — BaliTrade` };
}

export default function AdminProductsPage() {
  return <ProductsReview />;
}
