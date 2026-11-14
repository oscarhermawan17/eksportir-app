'use client';

import type { AuthUser } from '@balitrade/shared';
import { ChevronDown, ClipboardList, LayoutDashboard, LogOut, MessageSquare, ShoppingBag, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { buttonClasses } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { isAdmin, ordersBasePathFor } from '@/lib/home-path';

/** First letter of the first and last word, e.g. "Oscar Hermawan" -> "OH". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const ITEM = 'flex w-full items-center gap-2.5 rounded-button px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-background focus-visible:outline-2 focus-visible:outline-primary';

/**
 * Everything personal (orders, messages, the seller and admin areas) hangs off the avatar, so the
 * navbar itself carries no permanent text links and cannot overflow in any language.
 */
export function AccountMenu({ user }: { user: AuthUser }) {
  const t = useTranslations('Navbar');
  const { logout } = useAuth();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Close on Esc and on a click outside the menu (same pattern as the notification bell).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('button')?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  // An admin account neither buys nor sells: someone who also trades uses a separate account.
  const admin = isAdmin(user);
  const isSeller = user.roles.includes('SELLER');

  function item(href: string, icon: ReactNode, label: string) {
    return (
      <Link href={href} role="menuitem" onClick={() => setOpen(false)} className={ITEM}>
        {icon}
        {label}
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="menu"
        aria-label={t('accountMenu', { name: user.name })}
        className="flex items-center gap-0.5 rounded-button p-1 transition hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {initials(user.name)}
        </span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-card border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="border-b border-border px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold text-text">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>

          <div className="py-1.5">
            {/* A seller's orders live in their own area, so this entry follows them there. */}
            {admin ? null : item(ordersBasePathFor(user), <ClipboardList className="h-4 w-4 text-muted" aria-hidden="true" />, t('orders'))}
            {item('/messages', <MessageSquare className="h-4 w-4 text-muted" aria-hidden="true" />, t('messages'))}
            {admin
              ? null
              : item('/seller', <Store className="h-4 w-4 text-muted" aria-hidden="true" />, isSeller ? t('sellerArea') : t('sell'))}
            {/* Sellers and admins land in their own area, so the logo no longer takes them to the shop. */}
            {admin || isSeller ? item('/', <ShoppingBag className="h-4 w-4 text-muted" aria-hidden="true" />, t('viewShop')) : null}
          </div>

          {/* The admin pages live in the sidebar of the admin area, so one entry is enough here. */}
          {admin ? (
            <div className="border-t border-border py-1.5">
              {item('/admin', <LayoutDashboard className="h-4 w-4 text-muted" aria-hidden="true" />, t('adminArea'))}
            </div>
          ) : null}

          <div className="border-t border-border pt-1.5">
            <button type="button" role="menuitem" onClick={() => void logout()} className={ITEM}>
              <LogOut className="h-4 w-4 text-muted" aria-hidden="true" />
              {t('logout')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Log in / Sign up for visitors who are not signed in. `whitespace-nowrap` because the buttons have a
 * fixed height: a label that wraps does not make them taller, it spills out of them.
 *
 * Two rules decide what is shown. Never offer the page the visitor is already on — on /login the bar
 * points to signing up, on /register to logging in. And `single` keeps it to one button where there is
 * no room for two: on a phone, both of them beside the search field left that field 65 px wide in
 * Russian, where "Регистрация" alone is 126 px.
 *
 * Together they always leave exactly one way onwards on a phone: "Log in" from anywhere in the shop,
 * "Sign up" while on the login page, "Log in" while on the sign-up page.
 */
export function AuthButtons({ single = false }: { single?: boolean }) {
  const t = useTranslations('Navbar');
  const pathname = usePathname();
  const onLogin = pathname === '/login';

  const showLogin = !onLogin;
  // With room for one button, signing up is offered exactly where logging in is not: on /login.
  const showSignup = single ? onLogin : pathname !== '/register';
  // Whichever one is left over on its own carries the weight, so it gets the solid treatment.
  const soleButton = showLogin !== showSignup;

  return (
    <>
      {showLogin ? (
        <Link
          href="/login"
          className={buttonClasses(soleButton ? 'primary' : 'ghost', 'whitespace-nowrap px-3 sm:px-5')}
        >
          {t('login')}
        </Link>
      ) : null}
      {showSignup ? (
        <Link href="/register" className={buttonClasses('primary', 'whitespace-nowrap px-3 sm:px-5')}>
          {t('signup')}
        </Link>
      ) : null}
    </>
  );
}
