'use client';

import type { OrderView, PaymentSummary } from '@balitrade/shared';
import { canSubmitPayment } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

/** Statuses in which the money of an order is worth showing at all (before that there is nothing to pay). */
const MONEY_STATUSES = new Set(['AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'IN_QC', 'QC_READY', 'QC_APPROVED', 'ISSUE']);

/**
 * The money of one order on the order page: what is still open, where to pay (buyer), and the two steps that move
 * the order (admin). The seller never gets here — the API answers 404 for them, and this panel is not rendered.
 */
export function OrderPaymentPanel({ order, onChanged }: { order: OrderView; onChanged: () => void }) {
  const t = useTranslations('Payments');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const { user } = useAuth();
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const relevant = order.viewer !== 'SELLER' && MONEY_STATUSES.has(order.status);

  useEffect(() => {
    if (!relevant) return;
    let cancelled = false;
    apiFetch<PaymentSummary>(`/orders/${order.id}/payments`)
      .then((loaded) => !cancelled && setSummary(loaded))
      .catch((loadError: unknown) => {
        if (!cancelled) console.error('Could not load the payments of this order', loadError);
      });
    return () => {
      cancelled = true;
    };
  }, [order.id, order.status, relevant]);

  if (!relevant || summary === null) return null;

  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });
  const canPay = canSubmitPayment(order.viewer, order.status);
  const isAdmin = order.viewer === 'ADMIN';
  // Which admin may do what (the API enforces the same split): money is FINANCE, quality control is OPS.
  const holds = (role: string) => user?.roles.includes(role as never) ?? false;
  const handlesMoney = holds('ADMIN_FINANCE') || holds('ADMIN_OWNER');
  const handlesQc = holds('ADMIN_OPS') || holds('ADMIN_OWNER');

  async function run(path: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/orders/${order.id}/${path}`, { method: 'POST', body: {} });
      onChanged();
    } catch (failure) {
      setError(tErrors(errorKey(failure)));
      // 409: the order moved on meanwhile; re-read instead of leaving a stale screen.
      if (failure instanceof ApiError && failure.status === 409) onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="order-money" className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 id="order-money" className="text-xs font-bold uppercase tracking-wider text-muted">
        {t('panelTitle')}
      </h2>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3 text-text">
          <dt>{t('verified')}</dt>
          <dd className="tabular-nums">{money(summary.verifiedUsd)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-text">
          <dt>{t('remaining')}</dt>
          <dd className="font-bold tabular-nums">{money(summary.remainingUsd)}</dd>
        </div>
      </dl>

      {summary.submittedCount > 0 ? (
        <p className="mt-3 text-sm text-info">{t('waitingCount', { count: summary.submittedCount })}</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {canPay ? (
          <Link href={`/orders/${order.id}/pay`} className={buttonClasses('primary')}>
            {Number(summary.verifiedUsd) > 0 ? t('payRest') : t('payNow')}
          </Link>
        ) : null}

        {isAdmin ? (
          <>
            {handlesMoney ? (
              <Link href="/admin/payments" className="text-sm font-semibold text-primary hover:underline">
                {t('reviewPayments')}
              </Link>
            ) : null}
            {handlesMoney && order.status === 'PAYMENT_SUBMITTED' ? (
              <Button disabled={busy} onClick={() => void run('confirm-paid')}>
                {t('confirmPaidButton')}
              </Button>
            ) : null}
            {handlesQc && order.status === 'PAYMENT_VERIFIED' ? (
              <Button disabled={busy} onClick={() => void run('start-qc')}>
                {t('startQcButton')}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {isAdmin && handlesMoney && order.status === 'PAYMENT_SUBMITTED' ? (
        <p className="mt-2 text-xs text-muted">{t('confirmPaidHint')}</p>
      ) : null}
      {summary.payments.length > 0 ? (
        <p className="mt-3 text-xs text-muted">{t('historyCount', { count: summary.payments.length })}</p>
      ) : null}
    </section>
  );
}
