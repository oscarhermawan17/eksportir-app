import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Logo } from '@/components/ui/logo';
import { Link } from '@/i18n/navigation';

const COLUMNS = [
  {
    titleKey: 'forBuyers',
    links: [
      { href: '/how-it-works', key: 'howItWorksLink' },
      { href: '/request', key: 'requestProduct' },
      { href: '/how-it-works#payment', key: 'paymentMethods' },
      { href: '/how-it-works#shipping', key: 'shippingTracking' },
    ],
  },
  {
    titleKey: 'forSellers',
    links: [
      { href: '/register?role=seller', key: 'sell' },
      { href: '/seller-guidelines', key: 'sellerGuidelines' },
    ],
  },
  {
    titleKey: 'support',
    links: [
      { href: '/faq', key: 'faq' },
      { href: '/contact', key: 'contact' },
      { href: '/terms', key: 'terms' },
      { href: '/privacy', key: 'privacy' },
    ],
  },
] as const;

export function Footer() {
  const t = useTranslations('Footer');
  return (
    <footer className="relative bg-primary-hover text-white">
      {/* Very subtle Balinese-inspired dot pattern (design system: footer only) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-10 [background-image:radial-gradient(#C9A24A_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-3">
            <Logo onDark />
            <p className="max-w-xs text-sm text-white/70">{t('tagline')}</p>
            <Link href="/about" className="inline-block text-sm font-semibold text-gold hover:underline">
              {t('about')}
            </Link>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.titleKey} aria-label={t(column.titleKey)}>
              <h2 className="mb-3 text-sm font-semibold text-gold">{t(column.titleKey)}</h2>
              <ul className="space-y-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.key}>
                    <Link href={link.href} className="text-white/80 transition hover:text-white">
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-gold/30 pt-6 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <LanguageSwitcher onDark openUp />
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
            <span>{t('copyright')}</span>
            <span>{t('route')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
