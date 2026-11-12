import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CategoriesAdmin } from './categories-admin';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/categories'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminCategories' });
  return { title: `${t('title')} — BaliTrade` };
}

export default function AdminCategoriesPage() {
  return <CategoriesAdmin />;
}
