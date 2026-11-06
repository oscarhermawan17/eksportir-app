import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { MessagesView } from './messages-view';

export async function generateMetadata({ params }: PageProps<'/[locale]/messages'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Chat' });
  return { title: `${t('title')} — BaliTrade` };
}

// MessagesView reads the selected conversation from the URL (?c=), which needs a Suspense boundary.
export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesView />
    </Suspense>
  );
}
