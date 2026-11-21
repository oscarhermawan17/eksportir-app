import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminOrdersTable } from '../orders/orders-table';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/payouts'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Admin' });
  return { title: `${t('nav.payouts')} — BaliTrade` };
}

/**
 * The payout queue (T20, FINANCE + OWNER): completed orders whose seller has not been paid yet, or already paid. The
 * transfer itself is recorded on the order page, where the seller's bank details and the breakdown are shown.
 */
export default function AdminPayoutsPage() {
  return <AdminOrdersTable payoutQueue />;
}
