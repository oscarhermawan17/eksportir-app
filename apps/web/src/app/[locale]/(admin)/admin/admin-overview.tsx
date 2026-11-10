'use client';

import type { AdminProductView, AdminSellerView, CurrentRateView, OrderView } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import { isAdmin } from '@/lib/home-path';

/** Statuses that still need somebody to do something; the rest are finished or cancelled. */
const OPEN_ORDER_STATUSES = new Set([
  'REQUESTED',
  'ACCEPTED',
  'CHANGE_PROPOSED',
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'PAYMENT_VERIFIED',
  'IN_QC',
  'QC_READY',
  'QC_APPROVED',
  'ISSUE',
  'AWAITING_SHIPPING_PAYMENT',
  'SHIPPING_PAID',
  'SHIPPED',
  'ARRIVED',
]);

interface Counts {
  sellers: number | null;
  listings: number | null;
  orders: number;
  rate: CurrentRateView;
}

export function AdminOverview() {
  return <LoginGate allow={isAdmin}>{() => <Overview />}</LoginGate>;
}

function Overview() {
  const t = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Roles differ, so a page this admin may not read answers 403; that tile is simply hidden.
        const optional = <T,>(path: string) => apiFetch<T>(path).catch(() => null);
        const [sellers, listings, orders, rate] = await Promise.all([
          optional<AdminSellerView[]>('/admin/sellers?status=PENDING'),
          optional<AdminProductView[]>('/admin/products?status=PENDING_REVIEW'),
          apiFetch<OrderView[]>('/orders'),
          // The public endpoint, not the owner-only history: every admin may see which rate is in force, and
          // reading the history would answer 403 for OPS and FINANCE — which used to look like "no rate set".
          apiFetch<CurrentRateView>('/fx/current'),
        ]);
        if (!cancelled) {
          setCounts({
            sellers: sellers?.length ?? null,
            listings: listings?.length ?? null,
            orders: orders.filter((order) => OPEN_ORDER_STATUSES.has(order.status)).length,
            rate,
          });
        }
      } catch (error) {
        console.error('Could not load the admin overview', error);
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <h2 className="text-2xl font-bold text-text">{t('overview.title')}</h2>
      <p className="mt-1 text-sm text-muted">{t('overview.intro')}</p>

      {failed ? (
        <div role="alert" className="mt-6 flex flex-col items-start gap-3">
          <p className="text-error">{t('overview.loadError')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            {tCommon('retry')}
          </Button>
        </div>
      ) : counts === null ? (
        <div className="mt-6" aria-busy="true" />
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {counts.sellers === null ? null : (
              <Stat value={counts.sellers} label={t('overview.pendingSellers')} href="/admin/sellers?status=PENDING" />
            )}
            {counts.listings === null ? null : (
              <Stat value={counts.listings} label={t('overview.pendingListings')} href="/admin/products?status=PENDING_REVIEW" />
            )}
            <Stat value={counts.orders} label={t('overview.openOrders')} href="/admin/orders" highlight={false} />
          </ul>

          <div className="mt-6 rounded-card border border-border bg-card p-5 text-sm shadow-sm">
            {counts.rate.rate !== null ? (
              <p className="text-text">
                {t('overview.rate', { rate: format.number(Number(counts.rate.rate)) })}{' '}
                {counts.rate.updatedAt ? (
                  <span className="text-muted">
                    {t('overview.rateSet', { date: format.dateTime(new Date(counts.rate.updatedAt), { dateStyle: 'medium' }) })}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="font-semibold text-warning">{t('overview.noRate')}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ value, label, href, highlight = true }: { value: number; label: string; href: string; highlight?: boolean }) {
  const needsWork = highlight && value > 0;
  return (
    <li>
      <Link
        href={href}
        className={`flex h-full flex-col gap-1 rounded-card border bg-card p-5 transition hover:border-primary hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary ${
          needsWork ? 'border-gold' : 'border-border'
        }`}
      >
        <span className="text-3xl font-bold tabular-nums text-text">{value}</span>
        <span className="text-sm text-muted">{label}</span>
      </Link>
    </li>
  );
}
