'use client';

import type { OrderView, PaymentSummary, ShippingBillResponse, ShippingBillView } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { ShippingBillForm } from '@/components/shipping/shipping-bill-form';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

/** From QC approval on, shipping is part of the order's story. */
const SHIPPING_STATUSES = new Set(['QC_APPROVED', 'AWAITING_SHIPPING_PAYMENT', 'SHIPPING_PAID', 'SHIPPED', 'ARRIVED', 'COMPLETED']);

interface Loaded {
  bill: ShippingBillView | null;
  money: PaymentSummary | null;
}

/**
 * The shipping bill on the order page (T19), for the buyer and admins. The seller never sees it — the shipping money is
 * the buyer's business (owner, 2026-11-20) and the API answers 404 for them — so the panel is not rendered for them.
 * OPS issues or revises the bill here; FINANCE confirms that the shipping is paid; the buyer goes to the payment page.
 */
export function OrderShippingPanel({ order, onChanged }: { order: OrderView; onChanged: () => void }) {
  const t = useTranslations('Shipping');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [revising, setRevising] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const relevant = order.viewer !== 'SELLER' && SHIPPING_STATUSES.has(order.status);

  useEffect(() => {
    if (!relevant) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { bill } = await apiFetch<ShippingBillResponse>(`/orders/${order.id}/shipping-bill`);
        const money = bill ? await apiFetch<PaymentSummary>(`/orders/${order.id}/payments?purpose=SHIPPING`) : null;
        if (!cancelled) {
          setLoaded({ bill, money });
          setFailed(false);
        }
      } catch (loadError) {
        if (cancelled) return;
        console.error('Could not load the shipping bill', loadError);
        setFailed(true);
      }
    };
    void load();
    // The carton photo link expires after a few minutes; coming back to the tab fetches a fresh one.
    const refresh = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [order.id, order.status, relevant, attempt]);

  if (!relevant) return null;

  const holds = (role: string) => user?.roles.includes(role as never) ?? false;
  const isAdmin = order.viewer === 'ADMIN';
  const handlesOps = isAdmin && (holds('ADMIN_OPS') || holds('ADMIN_OWNER'));
  const handlesMoney = isAdmin && (holds('ADMIN_FINANCE') || holds('ADMIN_OWNER'));
  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });
  const awaiting = order.status === 'AWAITING_SHIPPING_PAYMENT';
  // The API refuses a revision once money was sent; a rejected proof does not count.
  const canRevise = handlesOps && awaiting && (loaded?.money?.payments ?? []).every((payment) => payment.status === 'REJECTED');

  async function confirmPaid() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/orders/${order.id}/confirm-shipping-paid`, { method: 'POST', body: {} });
      onChanged();
    } catch (failure) {
      setError(tErrors(errorKey(failure)));
      if (failure instanceof ApiError && failure.status === 409) onChanged();
    } finally {
      setBusy(false);
    }
  }

  const afterBill = () => {
    setRevising(false);
    setAttempt((n) => n + 1);
    onChanged();
  };

  return (
    <section aria-labelledby="order-shipping" className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 id="order-shipping" className="text-xs font-bold uppercase tracking-wider text-muted">
        {t('title')}
      </h2>

      {failed ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-error">{t('loadError')}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t('retry')}
          </Button>
        </div>
      ) : loaded === null ? (
        <p className="mt-3 text-sm text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {order.status === 'QC_APPROVED' ? (
            handlesOps ? (
              <ShippingBillForm orderId={order.id} revising={false} onSent={afterBill} onStale={onChanged} />
            ) : (
              <p className="text-sm text-text">{t('packing')}</p>
            )
          ) : null}

          {loaded.bill ? <Bill bill={loaded.bill} /> : null}

          {loaded.money ? (
            <dl className="space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between gap-3 text-text">
                <dt>{t('verified')}</dt>
                <dd className="tabular-nums">{money(loaded.money.verifiedUsd)}</dd>
              </div>
              <div className="flex justify-between gap-3 font-bold text-text">
                <dt>{t('remaining')}</dt>
                <dd className="tabular-nums">{money(loaded.money.remainingUsd)}</dd>
              </div>
              {loaded.money.submittedCount > 0 ? <p className="text-info">{t('waitingCount', { count: loaded.money.submittedCount })}</p> : null}
            </dl>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}

          {awaiting && order.viewer === 'BUYER' ? (
            <div className="space-y-2">
              <Link href={`/orders/${order.id}/pay`} className={buttonClasses('primary')}>
                {Number(loaded.money?.verifiedUsd ?? 0) > 0 ? t('payRest') : t('pay')}
              </Link>
              <p className="text-xs text-muted">{t('payHint')}</p>
            </div>
          ) : null}

          {awaiting && handlesMoney ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/admin/payments" className="text-sm font-semibold text-primary hover:underline">
                {t('reviewPayments')}
              </Link>
              <Button disabled={busy || Number(loaded.money?.verifiedUsd ?? 0) <= 0} onClick={() => void confirmPaid()}>
                {t('confirmPaid')}
              </Button>
              <p className="w-full text-xs text-muted">{t('confirmPaidHint')}</p>
            </div>
          ) : null}

          {canRevise ? (
            revising ? (
              <ShippingBillForm orderId={order.id} revising onSent={afterBill} onStale={onChanged} onCancel={() => setRevising(false)} />
            ) : (
              <Button variant="secondary" onClick={() => setRevising(true)}>
                {t('revise')}
              </Button>
            )
          ) : null}
        </div>
      )}
    </section>
  );
}

function Bill({ bill }: { bill: ShippingBillView }) {
  const t = useTranslations('Shipping');
  const format = useFormatter();
  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });
  const rupiah = Math.round(Number(bill.totalUsd) * Number(bill.fxRate));

  return (
    <div className="space-y-3">
      <p className="text-sm text-text">
        {t('packedSummary', { cartons: bill.cartons, kg: format.number(Number(bill.weightKg), { maximumFractionDigits: 2 }) })}
      </p>
      <dl className="space-y-1.5 text-sm">
        {bill.lines.map((line, index) => (
          <div key={`${index}-${line.label}`} className="flex justify-between gap-3 text-text">
            <dt className="min-w-0 break-words">{line.label}</dt>
            <dd className="tabular-nums">{money(line.amountUsd)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-bold text-text">
          <dt>{t('total')}</dt>
          <dd className="tabular-nums">{money(bill.totalUsd)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">
        {t('rupiahHint', {
          idr: format.number(rupiah),
          rate: format.number(Number(bill.fxRate), { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
        })}
      </p>
      {bill.note ? <p className="whitespace-pre-line break-words text-sm text-text">{bill.note}</p> : null}
      {bill.photoUrl ? (
        <a href={bill.photoUrl} target="_blank" rel="noopener noreferrer" className="block w-48 overflow-hidden rounded-button border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link from the private bucket */}
          <img src={bill.photoUrl} alt={t('photoAlt')} loading="lazy" className="aspect-square w-full object-cover" />
        </a>
      ) : null}
      <p className="text-xs text-muted">
        {t(bill.revised ? 'issuedRevised' : 'issued', { date: format.dateTime(new Date(bill.createdAt), { dateStyle: 'medium', timeStyle: 'short' }) })}
      </p>
    </div>
  );
}
