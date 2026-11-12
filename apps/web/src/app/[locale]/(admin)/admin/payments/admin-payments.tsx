'use client';

import type { PaymentStatus, PaymentView } from '@balitrade/shared';
import { PAYMENT_LIMITS } from '@balitrade/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { PaymentList } from '@/components/payments/payment-list';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

const FILTERS: (PaymentStatus | 'ALL')[] = ['SUBMITTED', 'VERIFIED', 'REJECTED', 'ALL'];

/** Money is an ADMIN_FINANCE job; the owner holds every role, so both see this page. */
const allowed = (user: { roles: readonly string[] }) => user.roles.some((role) => role === 'ADMIN_FINANCE' || role === 'ADMIN_OWNER');

export function AdminPayments() {
  return <LoginGate allow={allowed}>{() => <Payments />}</LoginGate>;
}

function Payments() {
  const t = useTranslations('Payments');
  const tAdmin = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const [filter, setFilter] = useState<PaymentStatus | 'ALL'>('SUBMITTED');
  const [payments, setPayments] = useState<PaymentView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const query = filter === 'ALL' ? '' : `?status=${filter}`;
    apiFetch<PaymentView[]>(`/admin/payments${query}`)
      .then((rows) => {
        if (!cancelled) {
          setPayments(rows);
          setFailed(false);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Could not load the payments', error);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, attempt]);

  async function run(path: string, body: object = {}) {
    setErrors([]);
    try {
      await apiFetch(path, { method: 'POST', body });
      setRejecting(null);
      setAttempt((n) => n + 1);
    } catch (error) {
      setErrors([tErrors(errorKey(error))]);
      // 409: somebody decided first, or the order moved on. Show what is true now.
      if (error instanceof ApiError && error.status === 409) setAttempt((n) => n + 1);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-text">{t('adminTitle')}</h2>
      <p className="mt-1 text-sm text-muted">{t('adminIntro')}</p>

      <ul className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <li key={option}>
            <button
              type="button"
              onClick={() => setFilter(option)}
              aria-current={filter === option ? 'true' : undefined}
              className={`rounded-button border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-primary ${
                filter === option ? 'border-primary bg-primary text-white' : 'border-border bg-card text-text hover:border-primary'
              }`}
            >
              {option === 'ALL' ? t('filterAll') : t(`status.${option}`)}
            </button>
          </li>
        ))}
      </ul>

      {errors.length > 0 ? (
        <div role="alert" className="mt-5 rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {errors[0]}
        </div>
      ) : null}

      <div className="mt-6">
        {failed ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-error">{t('adminLoadError')}</p>
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : payments === null ? (
          <p className="text-muted" aria-busy="true">
            {tAdmin('loading')}
          </p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted">{t('adminNone')}</p>
        ) : (
          <PaymentList
            payments={payments}
            actions={(payment) => (
              <>
                <Link href={`/admin/orders/${payment.orderId}`} className="text-sm font-semibold text-primary hover:underline">
                  {t('openOrder', { code: payment.orderCode })}
                </Link>
                {payment.status === 'SUBMITTED' ? (
                  rejecting === payment.id ? (
                    <form
                      className="mt-2 flex w-full flex-wrap items-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
                        setBusyId(payment.id);
                        void run(`/admin/payments/${payment.id}/reject`, reason ? { reason } : {});
                      }}
                    >
                      <label className="flex-1">
                        <span className="block text-xs font-bold uppercase tracking-wider text-text">{t('rejectReason')}</span>
                        <input
                          name="reason"
                          maxLength={PAYMENT_LIMITS.reasonMax}
                          autoFocus
                          className="mt-1 w-full rounded-card border border-border bg-card px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                        />
                      </label>
                      <Button type="submit" variant="danger" disabled={busyId === payment.id}>
                        {t('confirmReject')}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>
                        {tAdmin('cancel')}
                      </Button>
                    </form>
                  ) : (
                    <>
                      <Button
                        disabled={busyId !== null}
                        onClick={() => {
                          setBusyId(payment.id);
                          void run(`/admin/payments/${payment.id}/verify`);
                        }}
                      >
                        {t('verifyButton')}
                      </Button>
                      <Button variant="secondary" onClick={() => setRejecting(payment.id)}>
                        {t('rejectButton')}
                      </Button>
                    </>
                  )
                ) : null}
              </>
            )}
          />
        )}
      </div>
    </div>
  );
}
