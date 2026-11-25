import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { AuthProvider } from '@/components/auth/auth-provider';
import { routing } from '@/i18n/routing';
import { fontSans } from '../fonts';
import '../globals.css';

/** Matches the page background, so a phone's browser bar blends into the navbar. */
export const viewport: Viewport = { themeColor: '#ffffff' };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('title'), description: t('description') };
}

/**
 * Document, translations and session only. The chrome around a page differs per area and lives in the
 * route groups: `(shop)` has the storefront navbar and footer, `(admin)` has the sidebar and top bar.
 */
export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} className={`${fontSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
