import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { OrderDetail } from '@/components/orders/order-detail';

export async function generateMetadata({ params }: PageProps<'/[locale]/orders/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: `${t('title')} — BaliTrade` };
}

// OrderDetail carries no container of its own (the admin shell provides one there), so the storefront
// supplies the width and padding here.
async function DetailContent({ params }: { params: PageProps<'/[locale]/orders/[id]'>['params'] }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
      <OrderDetail id={id} />
    </div>
  );
}

// The order id is only known per request, so it is read inside a Suspense boundary.
export default function OrderPage({ params }: PageProps<'/[locale]/orders/[id]'>) {
  return (
    <Suspense>
      <DetailContent params={params} />
    </Suspense>
  );
}
