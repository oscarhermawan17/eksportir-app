'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { AccountMenu, AuthButtons } from '@/components/layout/account-menu';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { NavSearch } from '@/components/layout/nav-search';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Logo } from '@/components/ui/logo';

/**
 * Logo, search and the account avatar — no permanent text links, so the bar stays one line in every
 * language and for every role. Personal and admin pages live in the account menu.
 */
export function Navbar() {
  const { user, status } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4">
          <Logo />

          {/* Wide screens: search sits in the bar. Narrow screens: it moves to its own row below. */}
          <NavSearch className="hidden max-w-xl flex-1 md:block" />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            {user ? <NotificationBell /> : null}
            {status === 'loading' ? (
              // Reserve the space so the bar does not jump when the session answer arrives.
              <div className="h-11 w-24" aria-hidden="true" />
            ) : user ? (
              <AccountMenu user={user} />
            ) : (
              <AuthButtons />
            )}
          </div>
        </div>

        <NavSearch className="pb-3 md:hidden" />
      </div>
    </header>
  );
}
