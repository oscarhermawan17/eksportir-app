'use client';

import type { AdminSellerView, SellerStatus } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { Button } from '@/components/ui/button';
import { FormErrors, TextareaField } from '@/components/ui/field';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

type Filter = SellerStatus | 'ALL';
const FILTERS: Filter[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

export function SellersAdmin() {
  return (
    <LoginGate allow={(user) => user.roles.includes('ADMIN_OPS') || user.roles.includes('ADMIN_OWNER')}>
      {() => <SellerList />}
    </LoginGate>
  );
}

function SellerList() {
  const t = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [attempt, setAttempt] = useState(0);
  const [sellers, setSellers] = useState<AdminSellerView[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Changing the filter or retrying clears the list first (shows "loading"), then the effect refetches.
  const reload = (nextFilter: Filter) => {
    setSellers(null);
    setLoadFailed(false);
    setFilter(nextFilter);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminSellerView[]>(`/admin/sellers${filter === 'ALL' ? '' : `?status=${filter}`}`)
      .then((result) => {
        if (!cancelled) {
          setSellers(result);
        }
      })
      .catch((error: unknown) => {
        console.error('Could not load seller applications', error);
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filter, attempt]);

  const afterReview = (updated: AdminSellerView) => {
    // Drop the item from the list if it no longer matches the active filter; otherwise refresh it in place.
    setSellers((current) =>
      (current ?? [])
        .map((item) => (item.id === updated.id ? updated : item))
        .filter((item) => filter === 'ALL' || item.status === filter),
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">{t('sellersTitle')}</h1>

      <div role="tablist" aria-label={t('sellersTitle')} className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={filter === option}
            onClick={() => reload(option)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              filter === option
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-card text-text hover:border-primary'
            }`}
          >
            {t(`filter.${option}`)}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {loadFailed ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-error">{t('loadError')}</p>
            <Button variant="secondary" onClick={() => reload(filter)}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : sellers === null ? (
          <p className="text-muted" aria-busy="true">
            {t('loading')}
          </p>
        ) : sellers.length === 0 ? (
          <p className="rounded-card border border-border bg-card px-5 py-8 text-center text-muted">{t('empty')}</p>
        ) : (
          sellers.map((seller) => (
            <SellerCard key={seller.id} seller={seller} onReviewed={afterReview} errorText={(e) => tErrors(errorKey(e))} />
          ))
        )}
      </div>
    </div>
  );
}

function SellerCard({
  seller,
  onReviewed,
  errorText,
}: {
  seller: AdminSellerView;
  onReviewed: (seller: AdminSellerView) => void;
  errorText: (error: unknown) => string;
}) {
  const t = useTranslations('Admin');
  const tSeller = useTranslations('Seller');
  const format = useFormatter();
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function review(action: 'approve' | 'reject', body?: { reason: string }) {
    setBusy(true);
    setErrors([]);
    try {
      onReviewed(await apiFetch<AdminSellerView>(`/admin/sellers/${seller.id}/${action}`, { method: 'POST', body: body ?? {} }));
    } catch (error) {
      // 400 on approve means the seller has not picked a location yet.
      const message = action === 'approve' && error instanceof ApiError && error.status === 400 ? t('needsLocation') : errorText(error);
      setErrors([message]);
      setBusy(false);
    }
  }

  function onReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    void review('reject', { reason });
  }

  return (
    <article className="rounded-card border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">{seller.displayName}</h2>
          <p className="text-sm text-muted">
            {seller.user.name} · {seller.user.email}
            {seller.user.phone ? ` · ${seller.user.phone}` : ''}
          </p>
        </div>
        <StatusBadge status={seller.status} label={tSeller(`status.${seller.status}`)} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('location')}</dt>
          <dd className="mt-0.5 text-text">{seller.qcZone?.name ?? t('noLocation')}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('qcFee')}</dt>
          <dd className="mt-0.5 text-text">{seller.qcZone ? `$${seller.qcZone.feeUsd}` : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('appliedOn')}</dt>
          <dd className="mt-0.5 text-text">
            {format.dateTime(new Date(seller.createdAt), { dateStyle: 'medium' })}
          </dd>
        </div>
      </dl>

      <div className="mt-3 text-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('about')}</p>
        <p className="mt-0.5 whitespace-pre-line text-text">{seller.about || t('noAbout')}</p>
      </div>

      {seller.status === 'REJECTED' && seller.rejectionReason ? (
        <p className="mt-3 text-sm text-error">
          {t('rejectedWithReason')} {seller.rejectionReason}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <FormErrors messages={errors} />
        {rejecting ? (
          <form onSubmit={onReject} className="space-y-3">
            <TextareaField
              id={`reason-${seller.id}`}
              name="reason"
              label={t('reasonLabel')}
              helper={t('reasonHelper')}
              required
              minLength={3}
              maxLength={500}
              rows={3}
            />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={busy}>
                {t('confirmReject')}
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            {seller.status !== 'APPROVED' ? (
              <Button onClick={() => void review('approve')} disabled={busy}>
                {t('approve')}
              </Button>
            ) : null}
            {seller.status !== 'REJECTED' ? (
              <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy}>
                {seller.status === 'APPROVED' ? t('revoke') : t('reject')}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
