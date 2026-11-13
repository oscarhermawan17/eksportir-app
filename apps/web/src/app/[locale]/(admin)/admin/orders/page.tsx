import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminOrdersTable } from './orders-table';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/orders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: `${t('title')} — BaliTrade` };
}

// A dense table, not the storefront's card list: an admin scans every order, a buyer reads their own few.
export default function AdminOrdersPage() {
  return <AdminOrdersTable />;
}
