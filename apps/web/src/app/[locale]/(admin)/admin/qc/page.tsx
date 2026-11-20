import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminOrdersTable } from '../orders/orders-table';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/qc'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Admin' });
  return { title: `${t('nav.qc')} — BaliTrade` };
}

/**
 * OPS's quality-control queue (T18): the orders table narrowed to the three QC statuses, "needs a report" first. The
 * work itself happens on the order page (`/admin/orders/[id]`), where the report form and "check again" live.
 */
const QC_QUEUE = ['IN_QC', 'QC_READY', 'ISSUE'] as const;

export default function AdminQcPage() {
  return <AdminOrdersTable statuses={QC_QUEUE} />;
}
