'use client';

import { LogOut, Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button, buttonClasses } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { Link, usePathname } from '@/i18n/navigation';

type NavLink = { href: string; label: string };

/** Standard links for everyone, plus role-specific ones once the session is known. */
function useNavLinks(): NavLink[] {
  const t = useTranslations('Navbar');
  const { user } = useAuth();
  const links: NavLink[] = [
    { href: '/products', label: t('products') },
    { href: '/request', label: t('requestProduct') },
    { href: '/how-it-works', label: t('howItWorks') },
    // Visitors sign up as sellers; logged-in users manage or start their seller application.
    user ? { href: '/seller', label: t('sell') } : { href: '/register?role=seller', label: t('sell') },
  ];
  if (user) {
    links.push({ href: '/orders', label: t('orders') }, { href: '/messages', label: t('messages') });
  }
  if (user?.roles.includes('SELLER')) {
    links.push({ href: '/seller', label: t('sellerArea') });
  }
  if (user?.roles.some((role) => role === 'ADMIN_OPS' || role === 'ADMIN_OWNER')) {
    links.push({ href: '/admin/sellers', label: t('admin') }, { href: '/admin/products', label: t('adminProducts') });
  }
  if (user?.roles.includes('ADMIN_OWNER')) {
    links.push({ href: '/admin/exchange-rate', label: t('adminExchangeRate') });
  }
  return links.filter((link, index, all) => all.findIndex((other) => other.href === link.href) === index);
}

export function Navbar() {
  const t = useTranslations('Navbar');
  const pathname = usePathname();
  const links = useNavLinks();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label={t('mainNav')} className="hidden items-center gap-6 text-sm font-medium lg:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={active ? 'text-primary' : 'text-muted transition hover:text-primary'}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* One group for every screen size, so the language switcher and the bell exist once (the bell holds a socket subscription). */}
        <div className="flex items-center gap-1 lg:gap-2">
          <LanguageSwitcher />
          {user ? <NotificationBell /> : null}
          <div className="hidden items-center gap-2 lg:flex">
            <AuthActions />
          </div>
          <button
            type="button"
            className="rounded-button p-2 text-primary hover:bg-primary/5 lg:hidden"
            aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-border bg-card px-4 pb-4 lg:hidden">
          <nav aria-label={t('mobileNav')} className="flex flex-col py-2 text-sm font-medium">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-button px-2 py-3 text-text hover:bg-background"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2 border-t border-border pt-3" onClick={() => setMenuOpen(false)}>
            <AuthActions stacked />
          </div>
        </div>
      ) : null}
    </header>
  );
}

function AuthActions({ stacked = false }: { stacked?: boolean }) {
  const t = useTranslations('Navbar');
  const { user, status, logout } = useAuth();
  const widthClass = stacked ? 'w-full' : '';

  if (status === 'loading') {
    // Reserve the space so the navbar does not jump when the session answer arrives.
    return <div className="h-11 w-40" aria-hidden="true" />;
  }

  if (user) {
    return (
      <>
        <span className="max-w-40 truncate px-2 text-sm font-semibold text-text" title={user.email}>
          {user.name}
        </span>
        <Button variant="secondary" className={widthClass} onClick={() => void logout()}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('logout')}
        </Button>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className={buttonClasses('ghost', widthClass)}>
        {t('login')}
      </Link>
      <Link href="/register" className={buttonClasses('primary', widthClass)}>
        {t('signup')}
      </Link>
    </>
  );
}
