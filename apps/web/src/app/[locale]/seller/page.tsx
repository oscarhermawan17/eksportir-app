import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SellerHome } from './seller-home';

export async function generateMetadata({ params }: PageProps<'/[locale]/seller'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seller' });
  return { title: `${t('home.title')} — BaliTrade` };
}

export default function SellerPage() {
  return <SellerHome />;
}
