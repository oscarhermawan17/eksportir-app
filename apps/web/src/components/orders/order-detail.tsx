'use client';

import type { DeliveryAddress, OrderView } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { OrderActions } from '@/components/orders/order-actions';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch } from '@/lib/api';

type State = { id: string; order: OrderView | null; notFound: boolean };

/** `basePath` decides which area the back link points at: the shop (default) or the admin layout. */
export function OrderDetail({ id, basePath = '/orders' }: { id: string; basePath?: string }) {
  return <LoginGate>{() => <Detail id={id} basePath={basePath} />}</LoginGate>;
}

function Detail({ id, basePath }: { id: string; basePath: string }) {
  const t = useTranslations('Orders');
  const tCommon = useTranslations('Common');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State | null>(null);
  /** Set when an action hit an order that someone else had just changed; the page was reloaded with the fresh state. */
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      apiFetch<OrderView>(`/orders/${encodeURIComponent(id)}`)
        .then((order) => !cancelled && setState({ id, order, notFound: false }))
        .catch((error: unknown) => {
          if (cancelled) return;
          const notFound = error instanceof ApiError && error.status === 404;
          if (!notFound) console.error('Could not load the order', error);
          setState({ id, order: null, notFound });
        });
    void load();
    // The status changes through other people's actions: read again when the tab is shown.
    const refresh = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [id, attempt]);

  const current = state?.id === id ? state : null;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
      <nav className="mb-5 text-sm text-muted">
        <Link href={basePath} className="hover:text-primary hover:underline">
          ← {t('back')}
        </Link>
      </nav>
      {current === null ? (
        <p className="text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : current.order === null ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className={current.notFound ? 'text-text' : 'text-error'}>{current.notFound ? t('notFound') : t('loadError')}</p>
          {current.notFound ? null : (
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {tCommon('retry')}
            </Button>
          )}
        </div>
      ) : (
        <>
          {stale ? (
            <p role="status" className="mb-4 rounded-card border border-info/30 bg-info/5 px-4 py-3 text-sm text-info">
              {t('actions.staleNotice')}
            </p>
          ) : null}
          <Order
            order={current.order}
            onUpdated={(order) => {
              setStale(false);
              setState({ id, order, notFound: false });
            }}
            onStale={() => {
              setStale(true);
              setAttempt((n) => n + 1);
            }}
          />
        </>
      )}
    </div>
  );
}

function Order({ order, onUpdated, onStale }: { order: OrderView; onUpdated: (order: OrderView) => void; onStale: () => void }) {
  const t = useTranslations('Orders');
  const tProducts = useTranslations('Products');
  const format = useFormatter();
  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });
  const statusHintKey = `statusHint.${order.status}`;

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-text">{t('orderTitle', { code: order.code })}</h1>
          <OrderStatusBadge status={order.status} label={t(`status.${order.status}`)} />
        </div>
        <p className="text-sm text-muted">{t('requestedOn', { date: format.dateTime(new Date(order.createdAt), { dateStyle: 'long', timeStyle: 'short' }) })}</p>
        {t.has(statusHintKey) ? <p className="text-sm text-text">{t(statusHintKey)}</p> : null}
      </header>

      <OrderActions order={order} onUpdated={onUpdated} onStale={onStale} />

      <section aria-labelledby="order-item" className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 id="order-item" className="text-xs font-bold uppercase tracking-wider text-muted">
          {t('itemTitle')}
        </h2>
        <p className="mt-2 text-base font-semibold text-text">{order.item.title}</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <Row label={t('quantity')} value={`${format.number(order.item.qty)} ${tProducts(`units.${order.item.unit}`)}`} />
          <Row label={t('unitPrice')} value={money(order.item.unitPriceUsd)} />
          <Row label={t('note')} value={order.item.note ?? t('noNote')} />
          {order.proposal ? <Row label={t('proposedQty')} value={`${format.number(order.proposal.qty)} ${tProducts(`units.${order.item.unit}`)}`} /> : null}
        </dl>
        {order.item.productId ? (
          <Link href={`/products/${order.item.productId}`} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            {t('viewProduct')}
          </Link>
        ) : null}
      </section>

      <section aria-labelledby="order-totals" className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 id="order-totals" className="text-xs font-bold uppercase tracking-wider text-muted">
          {t('totalsTitle')}
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Line label={t('itemsSubtotal')} value={money(order.totals.itemsUsd)} />
          <Line label={t('qcFee')} value={money(order.totals.qcFeeUsd)} />
          <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-bold text-text">
            <dt>{t('totalSoFar')}</dt>
            <dd className="tabular-nums">{money(order.totals.totalUsd)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">{t('shippingNote')}</p>
        <p className="mt-1 text-xs text-muted">{t('rateUsed', { rate: format.number(Number(order.fxRate), { minimumFractionDigits: 2, maximumFractionDigits: 4 }) })}</p>
      </section>

      <section aria-labelledby="order-parties" className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 id="order-parties" className="text-xs font-bold uppercase tracking-wider text-muted">
          {t('parties')}
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Row label={t('buyer')} value={order.buyer.name} />
          <Row label={t('seller')} value={order.seller.displayName} />
        </dl>
      </section>

      <section aria-labelledby="order-delivery" className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 id="order-delivery" className="text-xs font-bold uppercase tracking-wider text-muted">
          {t('deliveryTitle')}
        </h2>
        {order.delivery ? <Delivery delivery={order.delivery} /> : <p className="mt-2 text-sm text-muted">{t('deliveryHidden')}</p>}
      </section>

      {order.conversationId ? (
        <Link href={`/messages?c=${order.conversationId}`} className={buttonClasses('primary')}>
          {t('openChat')}
        </Link>
      ) : null}
    </article>
  );
}

function Delivery({ delivery }: { delivery: DeliveryAddress }) {
  const t = useTranslations('Orders');
  return (
    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      <Row label={t('dialog.fullName')} value={delivery.fullName} />
      <Row label={t('dialog.phone')} value={delivery.phone} />
      <Row label={t('dialog.country')} value={t(`countries.${delivery.country}`)} />
      <div className="sm:col-span-2">
        <Row label={t('dialog.address')} value={delivery.address} />
      </div>
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-text">{value}</dd>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-text">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
