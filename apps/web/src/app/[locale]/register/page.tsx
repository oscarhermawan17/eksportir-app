import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { RegisterForm } from './register-form';

export async function generateMetadata({ params }: PageProps<'/[locale]/register'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('registerTitle') };
}

export default function RegisterPage() {
  // RegisterForm reads ?role=seller, which needs a Suspense boundary.
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
