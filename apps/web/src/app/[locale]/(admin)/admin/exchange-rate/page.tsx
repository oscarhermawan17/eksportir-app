import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ExchangeRateAdmin } from './exchange-rate-admin';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/exchange-rate'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminRate' });
  return { title: `${t('title')} — BaliTrade` };
}

export default function AdminExchangeRatePage() {
  return <ExchangeRateAdmin />;
}
