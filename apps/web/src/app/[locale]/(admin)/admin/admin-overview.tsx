'use client';

import type { AdminProductView, AdminSellerView, CurrentRateView, OrderView, PageResult } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
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
  'DELIVERY_ISSUE',
]);

interface Counts {
  sellers: number | null;
  listings: number | null;
  /** Orders whose goods are in hand and wait for a QC report (OPS and the owner only). */
  qc: number | null;
  /** Orders that passed QC and wait for packing and a shipping bill (T19, OPS and the owner). */
  toBill: number | null;
  /** Completed orders whose seller has not been paid out yet (T20, FINANCE and the owner). */
  toPay: number | null;
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
  const { user } = useAuth();
  const handlesQc = Boolean(user?.roles.some((role) => role === 'ADMIN_OPS' || role === 'ADMIN_OWNER'));
  const handlesMoney = Boolean(user?.roles.some((role) => role === 'ADMIN_FINANCE' || role === 'ADMIN_OWNER'));
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Roles differ, so a page this admin may not read answers 403; that tile is simply hidden.
        const optional = <T,>(path: string) => apiFetch<T>(path).catch(() => null);
        const [sellers, listings, qc, toBill, toPay, orders, rate] = await Promise.all([
          optional<AdminSellerView[]>('/admin/sellers?status=PENDING'),
          // Paged since T27: the count is `total`, not the length of a page (reading `.length` hid this tile).
          optional<PageResult<AdminProductView>>('/admin/products?status=PENDING_REVIEW'),
          // Every admin may read orders, but writing the QC report is OPS work (T18).
          handlesQc ? optional<PageResult<OrderView>>('/admin/orders?status=IN_QC') : Promise.resolve(null),
          handlesQc ? optional<PageResult<OrderView>>('/admin/orders?status=QC_APPROVED') : Promise.resolve(null),
          handlesMoney ? optional<PageResult<OrderView>>('/admin/orders?payout=unpaid') : Promise.resolve(null),
          apiFetch<OrderView[]>('/orders'),
          // The public endpoint, not the owner-only history: every admin may see which rate is in force, and
          // reading the history would answer 403 for OPS and FINANCE — which used to look like "no rate set".
          apiFetch<CurrentRateView>('/fx/current'),
        ]);
        if (!cancelled) {
          setCounts({
            sellers: sellers?.length ?? null,
            listings: listings?.total ?? null,
            qc: qc?.total ?? null,
            toBill: toBill?.total ?? null,
            toPay: toPay?.total ?? null,
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
  }, [attempt, handlesQc, handlesMoney]);

  return (
    <div>
      <p className="text-sm text-muted">{t('overview.intro')}</p>

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
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {counts.sellers === null ? null : (
              <Stat value={counts.sellers} label={t('overview.pendingSellers')} href="/admin/sellers?status=PENDING" />
            )}
            {counts.listings === null ? null : (
              <Stat value={counts.listings} label={t('overview.pendingListings')} href="/admin/products?status=PENDING_REVIEW" />
            )}
            {counts.qc === null ? null : <Stat value={counts.qc} label={t('overview.waitingQc')} href="/admin/qc" />}
            {counts.toBill === null ? null : <Stat value={counts.toBill} label={t('overview.waitingShippingBill')} href="/admin/shipping" />}
            {counts.toPay === null ? null : <Stat value={counts.toPay} label={t('overview.waitingPayout')} href="/admin/payouts" />}
            <Stat value={counts.orders} label={t('overview.openOrders')} href="/admin/orders" highlight={false} />
          </ul>

          <div className="mt-6 rounded-card border border-border bg-card p-5 text-sm">
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
        className={`flex h-full flex-col gap-1 rounded-card border bg-card p-5 transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary ${
          needsWork ? 'border-primary' : 'border-border'
        }`}
      >
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-text">{value}</span>
        <span className="text-sm text-muted">{label}</span>
      </Link>
    </li>
  );
}
