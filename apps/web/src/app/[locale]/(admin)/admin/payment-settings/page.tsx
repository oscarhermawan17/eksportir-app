import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PaymentSettingsAdmin } from './payment-settings-admin';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/payment-settings'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'PaymentSettings' });
  return { title: `${t('title')} — BaliTrade` };
}

export default function AdminPaymentSettingsPage() {
  return <PaymentSettingsAdmin />;
}
