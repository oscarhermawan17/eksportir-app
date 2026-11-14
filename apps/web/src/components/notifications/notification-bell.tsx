'use client';

import type { NotificationsResponse, NotificationView } from '@balitrade/shared';
import { Bell } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import { ordersBasePathFor } from '@/lib/home-path';
import { subscribeToNotifications } from '@/lib/chat-socket';

/** Without a live socket the list is re-read this often (and when the tab becomes visible again). */
const POLL_FALLBACK_MS = 60_000;

/** Merges a pushed notification into the list: an updated one moves to the top, a new one is added. */
function upsert(items: NotificationView[], item: NotificationView): NotificationView[] {
  return [item, ...items.filter((existing) => existing.id !== item.id)];
}

/** Bell with an unread badge and a dropdown of the latest notifications (new ones arrive live over the socket). */
export function NotificationBell() {
  const t = useTranslations('Notifications');
  const tOrders = useTranslations('Orders');
  const format = useFormatter();
  const { user } = useAuth();
  // An explicit "now" for relative times; it also keeps "1 minute ago" up to date while the panel is open.
  const now = useNow({ updateInterval: 30_000 });
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState(false);
  /** Bumped on every (re)connect so the list is read again and nothing sent while offline is missed. */
  const [reconnects, setReconnects] = useState(0);

  const load = useCallback(() => {
    apiFetch<NotificationsResponse>('/notifications')
      .then((result) => {
        setItems(result.items);
        setUnread(result.unreadCount);
        setFailed(false);
      })
      .catch((error: unknown) => {
        console.error('Could not load notifications', error);
        setFailed(true);
      });
  }, []);

  useEffect(
    () =>
      subscribeToNotifications({
        onCreated: ({ item, unreadCount }) => {
          setItems((current) => upsert(current ?? [], item));
          setUnread(unreadCount);
        },
        onCount: ({ unreadCount }) => {
          setUnread(unreadCount);
          // Something was read elsewhere: refresh the list so read items lose their "unread" look.
          load();
        },
        onStatus: (connected) => {
          setLive(connected);
          if (connected) setReconnects((n) => n + 1);
        },
      }),
    [load],
  );

  useEffect(() => {
    load();
    const refresh = () => {
      if (!document.hidden) load();
    };
    const timer = live ? undefined : setInterval(refresh, POLL_FALLBACK_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load, live, reconnects]);

  // Close on Esc and on a click outside the bell.
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

  // Order links follow the reader into their own area: a seller to /seller/orders, an admin to
  // /admin/orders, a buyer to the storefront list.
  const ordersBase = ordersBasePathFor(user);

  /** What a notification shows and where it leads, by type. */
  function describe(item: NotificationView): { href: string; title: string; subtitle: string | null; body: string; badge: string | null } {
    if (item.type === 'ORDER_REQUESTED') {
      const { orderId, code, buyerName, qty, productTitle } = item.payload;
      return {
        href: `${ordersBase}/${orderId}`,
        title: t('orderRequested', { code }),
        subtitle: null,
        body: t('orderRequestedBody', { buyer: buyerName, qty, product: productTitle }),
        badge: null,
      };
    }
    if (item.type === 'ORDER_STATUS') {
      const { orderId, code, status, productTitle, qty } = item.payload;
      const key = `orderStatus.${status}`;
      return {
        href: `${ordersBase}/${orderId}`,
        title: t.has(key) ? t(key, { code }) : t('orderStatusFallback', { code, status: tOrders(`status.${status}`) }),
        subtitle: null,
        body: t('orderStatusBody', { qty, product: productTitle }),
        badge: null,
      };
    }
    const { conversationId, senderName, productTitle, preview, count } = item.payload;
    return {
      href: `/messages?c=${conversationId}`,
      title: t('fromSender', { sender: senderName }),
      subtitle: productTitle,
      body: preview,
      badge: t('newMessages', { count }),
    };
  }

  function markRead(item: NotificationView) {
    setOpen(false);
    if (item.readAt) return;
    setItems((current) => (current ?? []).map((entry) => (entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)));
    setUnread((n) => Math.max(0, n - 1));
    apiFetch(`/notifications/${item.id}/read`, { method: 'POST' }).catch(() => load());
  }

  function markAllRead() {
    setItems((current) => (current ?? []).map((entry) => ({ ...entry, readAt: entry.readAt ?? new Date().toISOString() })));
    setUnread(0);
    apiFetch('/notifications/read-all', { method: 'POST' }).catch(() => load());
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread > 0 ? t('bellUnread', { count: unread }) : t('bell')}
        className="relative rounded-button p-2 text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={t('title')}
          // Phones: a sheet across the screen below the header; wider screens: a popover under the bell.
          className="fixed inset-x-4 top-[4.25rem] z-50 overflow-hidden rounded-card border border-border bg-card shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-text">{t('title')}</h2>
            {unread > 0 ? (
              <button type="button" onClick={markAllRead} className="text-xs font-semibold text-primary hover:underline">
                {t('markAllRead')}
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {failed && items === null ? (
              <p role="alert" className="px-4 py-6 text-center text-sm text-error">
                {t('loadError')}
              </p>
            ) : items === null ? (
              <p className="px-4 py-6 text-center text-sm text-muted" aria-busy="true">
                …
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">{t('empty')}</p>
            ) : (
              <ul>
                {items.map((item) => {
                  const line = describe(item);
                  return (
                    <li key={item.id} className="border-b border-border last:border-0">
                      <Link
                        href={line.href}
                        onClick={() => markRead(item)}
                        className={`block px-4 py-3 hover:bg-background focus-visible:outline-2 focus-visible:outline-primary ${item.readAt ? '' : 'bg-primary/5'}`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className={`text-sm text-text ${item.readAt ? '' : 'font-semibold'}`}>{line.title}</span>
                          <span className="shrink-0 text-[11px] text-muted">{format.relativeTime(new Date(item.updatedAt), now)}</span>
                        </span>
                        {line.subtitle ? <span className="block truncate text-xs text-muted">{line.subtitle}</span> : null}
                        <span className="mt-0.5 block truncate text-sm text-text">{line.body}</span>
                        {line.badge && !item.readAt ? (
                          <span className="mt-1 inline-block rounded-full bg-terracotta/10 px-2 py-px text-[11px] font-semibold text-terracotta">{line.badge}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link href="/messages" onClick={() => setOpen(false)} className="text-sm font-semibold text-primary hover:underline">
              {t('openMessages')}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
