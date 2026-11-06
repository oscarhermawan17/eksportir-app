import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from './login-form';

export async function generateMetadata({ params }: PageProps<'/[locale]/login'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('loginTitle') };
}

export default function LoginPage() {
  return <LoginForm />;
}
