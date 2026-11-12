'use client';

import { Menu, MessageSquare, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { activeNavItem, navItemsFor } from '@/components/admin/admin-nav';
import { useAuth } from '@/components/auth/auth-provider';
import { AccountMenu } from '@/components/layout/account-menu';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Logo } from '@/components/ui/logo';
import { Link, usePathname } from '@/i18n/navigation';
import { isAdmin } from '@/lib/home-path';

/**
 * The admin area's own chrome: dark-teal sidebar on the left, plain top bar above the content, and no
 * storefront navbar or footer. Deliberately no product search: the shop search only finds approved
 * products of approved sellers, which is the opposite of what admins work on.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('Admin');
  const { user, status } = useAuth();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Escape closes the drawer; following a link closes it in the link's own handler.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Visitors who are not admins still need a way out: the page itself shows the gate message.
  if (status !== 'loading' && (user === null || !isAdmin(user))) {
    return (
      <>
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center px-4 sm:px-6">
            <Logo />
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </>
    );
  }

  const items = user ? navItemsFor(user) : [];
  const active = activeNavItem(pathname);

  const sidebar = (
    <div className="flex h-full w-60 shrink-0 flex-col bg-primary-hover text-white">
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <div>
          <Logo onDark href="/admin" />
          <p className="mt-1 pl-[42px] text-xs font-bold uppercase tracking-[0.18em] text-gold">{t('adminBadge')}</p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label={t('closeMenu')}
          className="rounded-button p-2 text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-gold lg:hidden"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label={t('sidebarLabel')} className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const current = active?.href === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={current ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-button border-l-[3px] px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-gold ${
                    current ? 'border-gold bg-white/10 text-white' : 'border-transparent text-white/75 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/15 px-3 py-4">
        <Link
          href="/"
          onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-2 rounded-button px-3 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-gold"
        >
          {t('backToSite')}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label={t('closeMenu')}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative h-full">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('openMenu')}
              className="rounded-button p-2 text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary lg:hidden"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <h1 className="truncate text-lg font-bold text-text">{active ? t(`nav.${active.key}`) : t('adminBadge')}</h1>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <LanguageSwitcher />
              <Link
                href="/messages"
                aria-label={t('inbox')}
                className="rounded-button p-2 text-primary transition hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <MessageSquare className="h-5 w-5" aria-hidden="true" />
              </Link>
              {user ? <AccountMenu user={user} /> : <div className="h-11 w-11" aria-hidden="true" />}
            </div>
          </div>
        </header>

        {/*
          The one content container for the whole admin area. It used to be absent, so every page invented
          its own and no two agreed: three different widths (3xl/4xl/5xl), three vertical paddings, and the
          categories page had no padding at all. It is left-aligned on purpose — not `mx-auto` — because the
          top bar above is full width with the same `px-4 sm:px-6`, so this keeps a page's left edge in line
          with the page title instead of drifting towards the middle on a wide screen. A page renders its
          content directly and sets no container of its own; a narrow form limits its own card instead.
        */}
        <main className="flex flex-1 flex-col bg-background">
          <div className="w-full max-w-[1120px] flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
