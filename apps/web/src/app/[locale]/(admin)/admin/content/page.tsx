import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContentAdmin } from './content-admin';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/content'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminContent' });
  return { title: `${t('title')} — BaliTrade` };
}

export default function AdminContentPage() {
  return <ContentAdmin />;
}
