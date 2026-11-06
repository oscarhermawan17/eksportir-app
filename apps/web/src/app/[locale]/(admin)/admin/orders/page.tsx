import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrdersList } from '@/components/orders/orders-list';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/orders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: `${t('title')} — BaliTrade` };
}

// The same list the buyer and seller see; the API already scopes it (admins see every order).
export default function AdminOrdersPage() {
  return <OrdersList basePath="/admin/orders" />;
}
