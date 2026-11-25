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

const LINK = 'rounded-sm text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-primary';

/** Light and quiet (design system v2): a thin line above, the same page width as the navbar, no pattern. */
export function Footer() {
  const t = useTranslations('Footer');
  return (
    <footer className="border-t border-border bg-surface">
      <div className="page-container py-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="space-y-3 sm:col-span-2 md:col-span-1">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted">{t('tagline')}</p>
            <Link href="/about" className={`inline-block text-sm font-medium ${LINK}`}>
              {t('about')}
            </Link>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.titleKey} aria-label={t(column.titleKey)}>
              <h2 className="mb-3 text-sm font-semibold text-text">{t(column.titleKey)}</h2>
              <ul className="space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.key}>
                    <Link href={link.href} className={LINK}>
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
            <span>{t('copyright')}</span>
            <span>{t('route')}</span>
          </div>
          <div className="-ml-2.5 sm:ml-0">
            <LanguageSwitcher openUp />
          </div>
        </div>
      </div>
    </footer>
  );
}
