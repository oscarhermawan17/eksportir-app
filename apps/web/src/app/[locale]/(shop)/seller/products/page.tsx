import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductsList } from './products-list';

export async function generateMetadata({ params }: PageProps<'/[locale]/seller/products'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Products' });
  return { title: `${t('title')} — BaliTrade` };
}

export default function SellerProductsPage() {
  return <ProductsList />;
}
