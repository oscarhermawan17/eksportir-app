import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrdersList } from '@/components/orders/orders-list';

export async function generateMetadata({ params }: PageProps<'/[locale]/orders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: `${t('title')} — BaliTrade` };
}

/**
 * OrdersList carries neither a container nor a heading of its own, because it is also rendered inside the
 * admin shell, where the top bar is already the page's title and its own container supplies the width.
 * The storefront has no such chrome, so both belong here.
 */
export default async function OrdersPage({ params }: PageProps<'/[locale]/orders'>) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-10">
      <h1 className="mb-6 text-2xl font-bold text-text">{t('title')}</h1>
      <OrdersList />
    </div>
  );
}
