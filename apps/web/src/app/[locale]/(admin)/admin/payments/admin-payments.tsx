'use client';

import { DEFAULT_PAGE_SIZE, PAYMENT_LIMITS, PaymentStatus, type PageResult, type PaymentView } from '@balitrade/shared';
import { ExternalLink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { DataTable, type Column } from '@/components/admin/data-table';
import { DateRangePicker, useRangeLabel } from '@/components/admin/date-range-picker';
import { StatusTabs } from '@/components/admin/status-tabs';
import { ActiveFilters, SearchBox, type ActiveFilter } from '@/components/admin/table-filters';
import { Button } from '@/components/ui/button';
import { FormErrors } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import { getPrivateFileUrl } from '@/lib/media';
import { toApiQuery, useTableQuery } from '@/lib/table-query';

/** The tabs, in order; the first is the work queue and the default. */
const TABS = [PaymentStatus.SUBMITTED, PaymentStatus.VERIFIED, PaymentStatus.REJECTED, 'ALL'] as const;
type Tab = (typeof TABS)[number];
const OWN_FILTERS = ['q', 'from', 'to'];

const TONE: Record<PaymentView['status'], string> = {
  SUBMITTED: 'border-info/40 bg-info/5 text-info',
  VERIFIED: 'border-success/40 bg-success/5 text-success',
  REJECTED: 'border-error/40 bg-error/5 text-error',
};

/** Money is an ADMIN_FINANCE job; the owner holds every role, so both see this page. */
const allowed = (user: { roles: readonly string[] }) => user.roles.some((role) => role === 'ADMIN_FINANCE' || role === 'ADMIN_OWNER');

export function AdminPayments() {
  return <LoginGate allow={allowed}>{() => <Payments />}</LoginGate>;
}

/**
 * The FINANCE queue (T27): the shared admin table, where a row opens in place instead of leading away — checking a
 * transfer means comparing the proof with the amount, and a separate page would lose the list. The proof's signed
 * URL is only fetched when its row is opened.
 */
function Payments() {
  const t = useTranslations('Payments');
  const tTable = useTranslations('Table');
  const format = useFormatter();
  const rangeLabel = useRangeLabel();
  const table = useTableQuery();

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; page: PageResult<PaymentView> | null } | null>(null);

  const requested = table.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(requested) ? (requested as Tab) : TABS[0];
  const params = new URLSearchParams(toApiQuery(table, OWN_FILTERS));
  if (tab !== 'ALL') params.set('status', tab);
  const query = params.toString();
  const filtered = OWN_FILTERS.some((key) => table.get(key) !== '');
  const key = `${query}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    apiFetch<PageResult<PaymentView>>(`/admin/payments?${query}`)
      .then((page) => !cancelled && setLoaded({ key, page }))
      .catch((error: unknown) => {
        console.error('Could not load the payments', error);
        if (!cancelled) setLoaded({ key, page: null });
      });
    return () => {
      cancelled = true;
    };
  }, [query, key]);

  const current = loaded?.key === key ? loaded : null;
  const result = current?.page ?? null;
  const failed = current !== null && current.page === null;
  const counts = (current?.page ?? loaded?.page)?.statusCounts;
  const countOf = (status: Tab) =>
    counts === undefined ? undefined : status === 'ALL' ? Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0) : (counts[status] ?? 0);

  const amount = (payment: PaymentView) =>
    payment.amountIdr === null
      ? t('amountUsdt', { amount: payment.amountUsd })
      : t('amountIdrWithUsd', { idr: format.number(payment.amountIdr), usd: payment.amountUsd });
  const badge = (payment: PaymentView) => (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE[payment.status]}`}>
      {t(`status.${payment.status}`)}
    </span>
  );
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });

  const columns: Column<PaymentView>[] = [
    { key: 'order', header: t('columns.order'), className: 'whitespace-nowrap font-medium', cell: (payment) => payment.orderCode },
    { key: 'submitted', header: t('columns.submitted'), className: 'whitespace-nowrap', cell: (payment) => when(payment.submittedAt) },
    { key: 'buyer', header: t('columns.buyer'), cell: (payment) => payment.submittedBy.name },
    {
      key: 'method',
      header: t('columns.method'),
      cell: (payment) => (
        <span>
          {t(`method.${payment.method}`)}
          <span className="block text-xs text-muted">{t(`purpose.${payment.purpose}`)}</span>
        </span>
      ),
    },
    { key: 'amount', header: t('columns.amount'), className: 'text-right tabular-nums', cell: amount },
    { key: 'status', header: t('columns.status'), cell: badge },
  ];

  const card = (payment: PaymentView) => (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-text">{payment.orderCode}</span>
        {badge(payment)}
      </div>
      <p className="mt-1 text-sm tabular-nums text-text">{amount(payment)}</p>
      <p className="mt-0.5 text-sm text-muted">
        {payment.submittedBy.name} · {t(`method.${payment.method}`)} · {when(payment.submittedAt)}
      </p>
    </div>
  );

  const q = table.get('q');
  const from = table.get('from');
  const to = table.get('to');
  const chips: ActiveFilter[] = [
    ...(q ? [{ key: 'q', label: tTable('searchFilter', { q }), onRemove: () => table.set({ q: '' }) }] : []),
    ...(from || to ? [{ key: 'date', label: rangeLabel(from, to), onRemove: () => table.set({ from: '', to: '' }) }] : []),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('adminIntro')}</p>
      <DataTable
        rows={result?.items ?? null}
        failed={failed}
        onRetry={() => setAttempt((n) => n + 1)}
        columns={columns}
        rowKey={(payment) => payment.id}
        expand={(payment) => <PaymentReviewPanel payment={payment} onDone={() => setAttempt((n) => n + 1)} />}
        card={card}
        total={result?.total ?? 0}
        page={table.page}
        size={table.size}
        onPage={(next) => table.set({ page: next })}
        onSize={(next) => table.set({ size: next === DEFAULT_PAGE_SIZE ? '' : next, page: 1 })}
        filtered={filtered}
        tabs={
          <StatusTabs
            label={t('tabsLabel')}
            active={tab}
            onChange={(next) => table.set({ tab: next === TABS[0] ? '' : next })}
            tabs={TABS.map((status) => ({
              key: status,
              label: status === 'ALL' ? t('filterAll') : t(`status.${status}`),
              count: countOf(status),
            }))}
          />
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <SearchBox value={q} onSearch={(next) => table.set({ q: next })} placeholder={t('searchPlaceholder')} />
            <DateRangePicker from={from} to={to} onChange={(next) => table.set({ from: next.from, to: next.to })} />
          </div>
        }
        activeFilters={<ActiveFilters filters={chips} onReset={() => table.set({ q: '', from: '', to: '' })} />}
      />
    </div>
  );
}

/**
 * An opened payment: the proof next to everything it should be checked against, and the decision. The signed URL is
 * fetched when this mounts, i.e. when the row is opened, and lasts five minutes — "Open full size" fetches a fresh one.
 */
function PaymentReviewPanel({ payment, onDone }: { payment: PaymentView; onDone: () => void }) {
  const t = useTranslations('Payments');
  const tAdmin = useTranslations('Admin');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofFailed, setProofFailed] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getPrivateFileUrl(payment.proofKey)
      .then(({ url }) => !cancelled && setProofUrl(url))
      .catch(() => !cancelled && setProofFailed(true));
    return () => {
      cancelled = true;
    };
  }, [payment.proofKey]);

  async function decide(path: string, body: object = {}) {
    setBusy(true);
    setErrors([]);
    try {
      await apiFetch(path, { method: 'POST', body });
      onDone();
    } catch (error) {
      setErrors([tErrors(errorKey(error))]);
      // 409: somebody decided first, or the order moved on. Show what is true now.
      if (error instanceof ApiError && error.status === 409) onDone();
    } finally {
      setBusy(false);
    }
  }

  const facts: [string, string | null][] = [
    [t('form.senderName'), payment.senderName],
    [t('form.txHash'), payment.txHash],
    [t('form.exchangeName'), payment.exchangeName],
    [t('form.reference'), payment.reference],
    [t('form.note'), payment.note],
  ];

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,18rem)_1fr]">
      <figure>
        <figcaption className="mb-2 text-sm font-medium text-muted">{t('proofTitle')}</figcaption>
        <div className="flex aspect-[3/4] max-h-80 w-full items-center justify-center overflow-hidden rounded-card border border-border bg-card">
          {proofUrl && !proofFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- a five-minute signed URL from the private bucket
            <img
              src={proofUrl}
              alt={t('proofAlt', { code: payment.orderCode })}
              onError={() => setProofFailed(true)}
              className="h-full w-full object-contain"
            />
          ) : proofFailed ? (
            <p className="px-4 text-center text-sm text-error">{t('proofFailed')}</p>
          ) : (
            <p className="text-sm text-muted" aria-busy="true">
              {t('openingProof')}
            </p>
          )}
        </div>
        {proofUrl && !proofFailed ? (
          <button
            type="button"
            onClick={() =>
              void getPrivateFileUrl(payment.proofKey)
                .then(({ url }) => window.open(url, '_blank', 'noopener,noreferrer'))
                .catch(() => setProofFailed(true))
            }
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t('openFullSize')}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </figure>

      <div className="min-w-0 space-y-4 text-sm">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted">{t('columns.amount')}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-text">
              {payment.amountIdr === null
                ? t('amountUsdt', { amount: payment.amountUsd })
                : t('amountIdrWithUsd', { idr: format.number(payment.amountIdr), usd: payment.amountUsd })}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t('columns.method')}</dt>
            <dd className="mt-0.5 text-text">
              {t(`method.${payment.method}`)} · {t(`purpose.${payment.purpose}`)}
            </dd>
          </div>
          {facts.map(([label, value]) =>
            value ? (
              <div key={label}>
                <dt className="text-muted">{label}</dt>
                <dd className="mt-0.5 break-all text-text">{value}</dd>
              </div>
            ) : null,
          )}
        </dl>

        <div className="space-y-1 text-muted">
          <p>
            {t('submittedBy', {
              name: payment.submittedBy.name,
              date: format.dateTime(new Date(payment.submittedAt), { dateStyle: 'medium', timeStyle: 'short' }),
            })}
          </p>
          {payment.decidedBy && payment.decidedAt ? (
            <p>
              {t('decidedBy', {
                name: payment.decidedBy.name,
                date: format.dateTime(new Date(payment.decidedAt), { dateStyle: 'medium', timeStyle: 'short' }),
              })}
            </p>
          ) : null}
          {payment.rejectionReason ? <p className="text-error">{t('rejectedBecause', { reason: payment.rejectionReason })}</p> : null}
        </div>

        <FormErrors messages={errors} />

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Link
            href={`/admin/orders/${payment.orderId}`}
            className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t('openOrder', { code: payment.orderCode })}
          </Link>
          {payment.status === 'SUBMITTED' && !rejecting ? (
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" className="h-10" disabled={busy} onClick={() => setRejecting(true)}>
                {t('rejectButton')}
              </Button>
              <Button className="h-10" disabled={busy} onClick={() => void decide(`/admin/payments/${payment.id}/verify`)}>
                {t('verifyButton')}
              </Button>
            </div>
          ) : null}
        </div>

        {payment.status === 'SUBMITTED' && rejecting ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
              void decide(`/admin/payments/${payment.id}/reject`, reason ? { reason } : {});
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="block font-medium text-text">{t('rejectReason')}</span>
              <input
                name="reason"
                maxLength={PAYMENT_LIMITS.reasonMax}
                autoComplete="off"
                className="mt-1 h-10 w-full rounded-button border border-border-strong bg-card px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <Button type="button" variant="secondary" className="h-10" disabled={busy} onClick={() => setRejecting(false)}>
              {tAdmin('cancel')}
            </Button>
            <Button type="submit" variant="danger" className="h-10" disabled={busy}>
              {t('confirmReject')}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
