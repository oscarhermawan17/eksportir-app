import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminPayments } from './admin-payments';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/payments'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Payments' });
  return { title: `${t('adminTitle')} — BaliTrade` };
}

export default function AdminPaymentsPage() {
  return <AdminPayments />;
}
