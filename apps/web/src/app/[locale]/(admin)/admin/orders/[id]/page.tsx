import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { OrderDetail } from '@/components/orders/order-detail';

export async function generateMetadata({ params }: PageProps<'/[locale]/admin/orders/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Orders' });
  return { title: `${t('title')} — BaliTrade` };
}

async function DetailContent({ params }: { params: PageProps<'/[locale]/admin/orders/[id]'>['params'] }) {
  const { id } = await params;
  return <OrderDetail id={id} basePath="/admin/orders" />;
}

// The order id is only known per request, so it is read inside a Suspense boundary.
export default function AdminOrderPage({ params }: PageProps<'/[locale]/admin/orders/[id]'>) {
  return (
    <Suspense>
      <DetailContent params={params} />
    </Suspense>
  );
}
