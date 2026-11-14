import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrdersList } from '@/components/orders/orders-list';

export async function generateMetadata({ params }: PageProps<'/[locale]/seller/orders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: `${t('title')} — BaliTrade` };
}

// OrdersList carries neither a container nor a heading of its own: the seller shell's top bar is the
// page title and its container supplies the width, exactly as in the admin area.
export default function SellerOrdersPage() {
  return <OrdersList basePath="/seller/orders" />;
}
