import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrdersList } from './orders-list';

export async function generateMetadata({ params }: PageProps<'/[locale]/orders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: `${t('title')} — BaliTrade` };
}

export default function OrdersPage() {
  return <OrdersList />;
}
