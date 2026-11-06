import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminOverview } from './admin-overview';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Admin' });
  return { title: `${t('overview.title')} — BaliTrade` };
}

export default function AdminOverviewPage() {
  return <AdminOverview />;
}
