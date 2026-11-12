import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrdersList } from '@/components/orders/orders-list';

export async function generateMetadata({ params }: PageProps<'/[locale]/orders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: `${t('title')} — BaliTrade` };
}

// OrdersList carries no container of its own (it is also rendered inside the admin shell, which has one),
// so the storefront supplies the width and padding here.
export default function OrdersPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-10">
      <OrdersList />
    </div>
  );
}
