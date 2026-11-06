'use client';

import type { AuthUser } from '@balitrade/shared';
import { ChevronDown, ClipboardList, Coins, LogOut, MessageSquare, Store, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

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

  const isSeller = user.roles.includes('SELLER');
  const isOps = user.roles.some((role) => role === 'ADMIN_OPS' || role === 'ADMIN_OWNER');
  const isOwner = user.roles.includes('ADMIN_OWNER');

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
            {item('/orders', <ClipboardList className="h-4 w-4 text-muted" aria-hidden="true" />, t('orders'))}
            {item('/messages', <MessageSquare className="h-4 w-4 text-muted" aria-hidden="true" />, t('messages'))}
            {item('/seller', <Store className="h-4 w-4 text-muted" aria-hidden="true" />, isSeller ? t('sellerArea') : t('sell'))}
          </div>

          {isOps ? (
            <div className="border-t border-border py-1.5">
              <p className="px-3 pb-1 pt-0.5 text-xs font-bold uppercase tracking-wider text-muted">{t('adminSection')}</p>
              {item('/admin/sellers', <UserCheck className="h-4 w-4 text-muted" aria-hidden="true" />, t('adminSellers'))}
              {item('/admin/products', <ClipboardList className="h-4 w-4 text-muted" aria-hidden="true" />, t('adminProducts'))}
              {isOwner
                ? item('/admin/exchange-rate', <Coins className="h-4 w-4 text-muted" aria-hidden="true" />, t('adminExchangeRate'))
                : null}
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

/** Log in / Sign up for visitors who are not signed in. */
export function AuthButtons() {
  const t = useTranslations('Navbar');
  return (
    <>
      <Link href="/login" className={buttonClasses('ghost', 'px-3 sm:px-5')}>
        {t('login')}
      </Link>
      <Link href="/register" className={buttonClasses('primary', 'px-3 sm:px-5')}>
        {t('signup')}
      </Link>
    </>
  );
}
