'use client';

import type { PaymentView } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { getPrivateFileUrl } from '@/lib/media';

/** Opens the proof in a new tab through a short-lived signed URL (the file is in the private bucket). */
function ProofLink({ payment }: { payment: PaymentView }) {
  const t = useTranslations('Payments');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setFailed(false);
          void getPrivateFileUrl(payment.proofKey)
            .then(({ url }) => window.open(url, '_blank', 'noopener,noreferrer'))
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
        className="text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
      >
        {busy ? t('openingProof') : t('viewProof')}
      </button>
      {failed ? <span className="ml-2 text-sm text-error">{t('proofFailed')}</span> : null}
    </>
  );
}

/**
 * Every payment of an order, newest first. Rows are never replaced, so a rejected attempt stays visible with its
 * reason — that history is the point. `actions` lets the admin screen add Verify/Reject without duplicating the row.
 */
export function PaymentList({ payments, actions }: { payments: PaymentView[]; actions?: (payment: PaymentView) => ReactNode }) {
  const t = useTranslations('Payments');
  const format = useFormatter();

  if (payments.length === 0) {
    return <p className="text-sm text-muted">{t('noneYet')}</p>;
  }

  const tone: Record<PaymentView['status'], string> = {
    SUBMITTED: 'border-info/40 bg-info/5 text-info',
    VERIFIED: 'border-success/40 bg-success/5 text-success',
    REJECTED: 'border-error/40 bg-error/5 text-error',
  };

  return (
    <ul className="space-y-3">
      {payments.map((payment) => (
        <li key={payment.id} className="rounded-card border border-border bg-card p-4 text-sm shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-base font-bold tabular-nums text-text">
              {payment.amountIdr === null
                ? t('amountUsdt', { amount: payment.amountUsd })
                : t('amountIdrWithUsd', { idr: format.number(payment.amountIdr), usd: payment.amountUsd })}
            </span>
            <span className={`rounded-button border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${tone[payment.status]}`}>
              {t(`status.${payment.status}`)}
            </span>
            <span className="text-muted">{t(`method.${payment.method}`)}</span>
          </div>

          <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {payment.senderName ? <Pair label={t('form.senderName')} value={payment.senderName} /> : null}
            {payment.txHash ? <Pair label={t('form.txHash')} value={payment.txHash} /> : null}
            {payment.exchangeName ? <Pair label={t('form.exchangeName')} value={payment.exchangeName} /> : null}
            {payment.reference ? <Pair label={t('form.reference')} value={payment.reference} /> : null}
            {payment.note ? <Pair label={t('form.note')} value={payment.note} /> : null}
          </dl>

          <p className="mt-2 text-xs text-muted">
            {t('submittedBy', {
              name: payment.submittedBy.name,
              date: format.dateTime(new Date(payment.submittedAt), { dateStyle: 'medium', timeStyle: 'short' }),
            })}
          </p>
          {payment.decidedBy && payment.decidedAt ? (
            <p className="text-xs text-muted">
              {t('decidedBy', {
                name: payment.decidedBy.name,
                date: format.dateTime(new Date(payment.decidedAt), { dateStyle: 'medium', timeStyle: 'short' }),
              })}
            </p>
          ) : null}
          {payment.rejectionReason ? <p className="mt-1 text-sm text-error">{t('rejectedBecause', { reason: payment.rejectionReason })}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ProofLink payment={payment} />
            {actions?.(payment)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 break-all text-text">{value}</dd>
    </div>
  );
}
