import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminOrdersTable } from '../orders/orders-table';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/shipping'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Admin' });
  return { title: `${t('nav.shipping')} — BaliTrade` };
}

/**
 * OPS's shipping queue (T19): ready to bill, waiting for the shipping money, ready to hand to the cargo, in transit.
 * The work itself happens on the order page, where the bill form and the tracking form live.
 */
const SHIPPING_QUEUE = ['QC_APPROVED', 'AWAITING_SHIPPING_PAYMENT', 'SHIPPING_PAID', 'SHIPPED'] as const;

export default function AdminShippingPage() {
  return <AdminOrdersTable statuses={SHIPPING_QUEUE} />;
}
