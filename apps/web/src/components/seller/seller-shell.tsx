'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { AccountMenu } from '@/components/layout/account-menu';
import { Footer } from '@/components/layout/footer';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Navbar } from '@/components/layout/navbar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { SELLER_NAV, activeSellerNavItem, type SellerNavItem } from '@/components/seller/seller-nav';
import { SellerSearch } from '@/components/seller/seller-search';
import { Logo } from '@/components/ui/logo';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The seller area's own chrome, replacing the storefront navbar and footer.
 *
 * Two deliberate differences from `AdminShell`. The sidebar is light, not dark teal: a seller is not an
 * admin and should not feel put inside the staff panel. And below `lg` there is no drawer but a bottom
 * tab bar, because sellers work on a phone and their main navigation should not be hidden behind a
 * hamburger. Both are rendered from the one `SELLER_NAV` list.
 *
 * The top bar carries the page title, so pages here render no heading and no container of their own.
 */
export function SellerShell({ children }: { children: ReactNode }) {
  const t = useTranslations('Seller');
  const { user, status } = useAuth();
  const pathname = usePathname();

  // `/seller` is also where a buyer applies to become a seller, so this chrome is only for people who
  // already have the role. A visitor who does not stays in the storefront chrome, which is where they
  // still are: the page itself then shows the application form or its own "please log in" message.
  const isSeller = user !== null && user.roles.includes('SELLER');
  if (status !== 'loading' && !isSeller) {
    return (
      <>
        <Navbar />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </>
    );
  }

  const active = activeSellerNavItem(pathname);
  const isCurrent = (item: SellerNavItem) => active?.href === item.href;

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="px-5 py-5">
          <Logo href="/seller" />
          {/* Gold on a light background fails contrast, hence the darker `gold-text` token. */}
          <p className="mt-1 pl-[42px] text-xs font-bold uppercase tracking-[0.18em] text-gold-text">{t('shell.sellerBadge')}</p>
        </div>

        <nav aria-label={t('shell.sidebarLabel')} className="flex-1 px-3 py-2">
          <ul className="space-y-1">
            {SELLER_NAV.map((item) => {
              const Icon = item.icon;
              const shared = 'flex items-center gap-3 rounded-button border-l-[3px] px-3 py-2.5 text-sm font-semibold transition';
              return (
                <li key={item.href}>
                  {item.soon ? (
                    // Plain text, not a link: it cannot be clicked and Tab skips it, so the planned area
                    // is visible without being a dead end.
                    <span aria-disabled="true" className={`${shared} border-transparent text-muted/60`}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t(`nav.${item.key}`)}
                      <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                        {t('shell.soon')}
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={isCurrent(item) ? 'page' : undefined}
                      className={`${shared} focus-visible:outline-2 focus-visible:outline-primary ${
                        isCurrent(item) ? 'border-gold bg-primary/5 text-primary' : 'border-transparent text-muted hover:bg-background hover:text-text'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t(`nav.${item.key}`)}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border px-3 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-button px-3 py-2 text-sm font-semibold text-muted transition hover:bg-background hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t('shell.viewShop')}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <h1 className="truncate text-lg font-bold text-text">{active ? t(`nav.${active.key}`) : t('home.title')}</h1>
            <SellerSearch className="ml-2 hidden max-w-xs flex-1 md:block" />
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <LanguageSwitcher />
              {user ? <NotificationBell /> : null}
              {user ? <AccountMenu user={user} /> : <div className="h-11 w-11" aria-hidden="true" />}
            </div>
          </div>
        </header>

        {/*
          The one content container for the whole seller area, left-aligned like the admin one so a page's
          left edge lines up with the title above it. `pb-24` keeps the last row clear of the bottom bar.
        */}
        <main className="flex flex-1 flex-col bg-background">
          <div className="w-full max-w-[1120px] flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:pb-10">{children}</div>
        </main>
      </div>

      <nav
        aria-label={t('shell.bottomBarLabel')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex">
          {SELLER_NAV.map((item) => {
            const Icon = item.icon;
            const shared = 'relative flex h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold';
            return (
              <li key={item.href} className="min-w-0 flex-1">
                {item.soon ? (
                  <span aria-disabled="true" className={`${shared} text-muted/50`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="max-w-full truncate">{t(`navShort.${item.key}`)}</span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={isCurrent(item) ? 'page' : undefined}
                    className={`${shared} transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                      isCurrent(item) ? 'text-primary' : 'text-muted'
                    }`}
                  >
                    {isCurrent(item) ? <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-gold" aria-hidden="true" /> : null}
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="max-w-full truncate">{t(`navShort.${item.key}`)}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
