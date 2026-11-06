import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NewProduct } from '../product-pages';

export async function generateMetadata({ params }: PageProps<'/[locale]/seller/products/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Products' });
  return { title: `${t('newTitle')} — BaliTrade` };
}

export default function NewProductPage() {
  return <NewProduct />;
}
