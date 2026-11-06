import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { OrderDetail } from '@/components/orders/order-detail';

export async function generateMetadata({ params }: PageProps<'/[locale]/orders/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: `${t('title')} — BaliTrade` };
}

async function DetailContent({ params }: { params: PageProps<'/[locale]/orders/[id]'>['params'] }) {
  const { id } = await params;
  return <OrderDetail id={id} />;
}

// The order id is only known per request, so it is read inside a Suspense boundary.
export default function OrderPage({ params }: PageProps<'/[locale]/orders/[id]'>) {
  return (
    <Suspense>
      <DetailContent params={params} />
    </Suspense>
  );
}
