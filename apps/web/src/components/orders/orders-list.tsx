'use client';

import type { OrderView } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

/** `basePath` decides which area the rows link into: the shop (default) or the admin layout. */
export function OrdersList({ basePath = '/orders' }: { basePath?: string }) {
  return <LoginGate>{() => <Orders basePath={basePath} />}</LoginGate>;
}

function Orders({ basePath }: { basePath: string }) {
  const t = useTranslations('Orders');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      apiFetch<OrderView[]>('/orders')
        .then((list) => !cancelled && setOrders(list))
        .catch((error: unknown) => {
          console.error('Could not load orders', error);
          if (!cancelled) setFailed(true);
        });
    void load();
    // Statuses change through other people's actions: read again when the tab is shown.
    const refresh = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [attempt]);

  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });

  return (
    <div className="space-y-6">
      {failed ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-error">{t('loadError')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setFailed(false);
              setOrders(null);
              setAttempt((n) => n + 1);
            }}
          >
            {tCommon('retry')}
          </Button>
        </div>
      ) : orders === null ? (
        <p className="text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : orders.length === 0 ? (
        <p className="rounded-card border border-border bg-card px-5 py-10 text-center text-muted">{t('emptyBuyer')}</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`${basePath}/${order.id}`}
                className="block rounded-card border border-border bg-card p-4 shadow-sm transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-semibold text-text">{order.code}</span>
                    <OrderStatusBadge status={order.status} label={t(`status.${order.status}`)} />
                  </span>
                  <span className="text-xs text-muted">{format.dateTime(new Date(order.createdAt), { dateStyle: 'medium' })}</span>
                </span>
                <span className="mt-2 block text-sm text-text">{t('listLine', { qty: format.number(order.item.qty), title: order.item.title })}</span>
                <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                  <span>
                    {order.viewer === 'BUYER'
                      ? t('sellerLine', { name: order.seller.displayName })
                      : order.viewer === 'SELLER'
                        ? t('buyerLine', { name: order.buyer.name })
                        : `${t('buyerLine', { name: order.buyer.name })} · ${t('sellerLine', { name: order.seller.displayName })}`}
                  </span>
                  <span className="font-semibold tabular-nums text-text">
                    {t('total')}: {money(order.totals.totalUsd)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
