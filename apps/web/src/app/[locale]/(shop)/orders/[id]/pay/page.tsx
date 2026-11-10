import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { PayOrder } from '@/components/payments/pay-order';

export async function generateMetadata({ params }: PageProps<'/[locale]/orders/[id]/pay'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Payments' });
  return { title: `${t('pageTitle')} — BaliTrade` };
}

async function PayContent({ params }: { params: PageProps<'/[locale]/orders/[id]/pay'>['params'] }) {
  const { id } = await params;
  return <PayOrder id={id} />;
}

// The order id is only known per request, so it is read inside a Suspense boundary (cacheComponents).
export default function PayPage({ params }: PageProps<'/[locale]/orders/[id]/pay'>) {
  return (
    <Suspense>
      <PayContent params={params} />
    </Suspense>
  );
}
