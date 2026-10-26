import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import { routing } from '@/i18n/routing';
import '../globals.css';

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin', 'cyrillic-ext'],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('title'), description: t('description') };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>
          <AuthProvider>
            {/* usePathname() inside Navbar needs a Suspense boundary on routes with a dynamic segment such as [id]. */}
            <Suspense fallback={<div className="h-16 border-b border-border bg-card" aria-hidden="true" />}>
              <Navbar />
            </Suspense>
            <main className="flex flex-1 flex-col">{children}</main>
            <Suspense fallback={null}>
              <Footer />
            </Suspense>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
