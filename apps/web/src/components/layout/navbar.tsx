'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { AccountMenu, AuthButtons } from '@/components/layout/account-menu';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { NavSearch } from '@/components/layout/nav-search';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Logo } from '@/components/ui/logo';
import { homePathFor } from '@/lib/home-path';

/**
 * Logo, search and the account avatar — no permanent text links, so the bar stays one line in every
 * language and for every role. Personal and admin pages live in the account menu.
 *
 * Below `md` it is two rows, and what goes where was decided by measuring what breaks. A visitor who is
 * not signed in used to get the logo, the language switcher and both auth buttons on one 375px line:
 * "Log in" wrapped over two lines and "Sign up" ran 29px past the right edge of the page. So the first
 * row keeps only the brand and the language switcher, and the second holds the search field and a
 * single auth button — both buttons there still left the search field 120px wide in Russian at 375px
 * and 65px at 320px, which is the icon and nothing else. Which single button it is depends on the
 * page, so there is always one way onwards; see `AuthButtons`.
 */
export function Navbar() {
  const { user, status } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4">
          <Logo href={homePathFor(user)} />

          {/* Wide screens: search sits in the bar. Narrow screens: it moves to its own row below. */}
          <NavSearch className="hidden max-w-xl flex-1 md:block" />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            {user ? <NotificationBell /> : null}
            {status === 'loading' ? (
              // Reserve the space so the bar does not jump when the session answer arrives.
              <div className="h-11 w-11 md:w-24" aria-hidden="true" />
            ) : user ? (
              <AccountMenu user={user} />
            ) : (
              // From md the buttons belong up here; below it they are in the second row.
              <div className="hidden items-center gap-2 md:flex">
                <AuthButtons />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pb-3 md:hidden">
          <NavSearch className="min-w-0 flex-1" />
          {user ? null : (
            // Kept in the layout while the session answer is on its way, only invisible, so the search
            // field does not jump narrower the moment it arrives. `visibility: hidden` also keeps the
            // buttons out of the tab order while they cannot be seen.
            <div className={`flex shrink-0 items-center gap-2 ${status === 'loading' ? 'invisible' : ''}`}>
              <AuthButtons single />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
