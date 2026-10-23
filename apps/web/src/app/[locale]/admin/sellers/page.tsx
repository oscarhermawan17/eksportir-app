import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SellersAdmin } from './sellers-admin';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/sellers'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Admin' });
  return { title: `${t('sellersTitle')} — BaliTrade` };
}

export default function AdminSellersPage() {
  return <SellersAdmin />;
}
