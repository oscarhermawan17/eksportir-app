'use client';

import type { OrderView } from '@balitrade/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { OrderRow } from '@/components/orders/order-row';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

/** `basePath` decides which area the rows link into: the shop (default) or the admin layout. */
export function OrdersList({ basePath = '/orders' }: { basePath?: string }) {
  return <LoginGate>{() => <Orders basePath={basePath} />}</LoginGate>;
}

function Orders({ basePath }: { basePath: string }) {
  const t = useTranslations('Orders');
  const tCommon = useTranslations('Common');
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
              <OrderRow order={order} basePath={basePath} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
