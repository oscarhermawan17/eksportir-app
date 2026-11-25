'use client';

import { DEFAULT_PAGE_SIZE, SellerStatus, type AdminSellerView, type PageResult } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { DataTable, type Column } from '@/components/admin/data-table';
import { DateRangePicker, useRangeLabel } from '@/components/admin/date-range-picker';
import { StatusTabs } from '@/components/admin/status-tabs';
import { ActiveFilters, SearchBox, type ActiveFilter } from '@/components/admin/table-filters';
import { Button } from '@/components/ui/button';
import { FormErrors, TextareaField } from '@/components/ui/field';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import { toApiQuery, useTableQuery } from '@/lib/table-query';

/** The tabs, in order; the first is the approval queue and the default. */
const TABS = [SellerStatus.PENDING, SellerStatus.APPROVED, SellerStatus.REJECTED, 'ALL'] as const;
type Tab = (typeof TABS)[number];
const OWN_FILTERS = ['q', 'from', 'to'];

export function SellersAdmin() {
  return (
    <LoginGate allow={(user) => user.roles.includes('ADMIN_OPS') || user.roles.includes('ADMIN_OWNER')}>
      {() => <SellerList />}
    </LoginGate>
  );
}

/**
 * Seller applications (T27): the shared admin table, oldest application first, where a row opens in place with the
 * details and the decision — the same pattern as the payments queue.
 */
function SellerList() {
  const t = useTranslations('Admin');
  const tSeller = useTranslations('Seller');
  const tTable = useTranslations('Table');
  const format = useFormatter();
  const rangeLabel = useRangeLabel();
  const table = useTableQuery();

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; page: PageResult<AdminSellerView> | null } | null>(null);

  const requested = table.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(requested) ? (requested as Tab) : TABS[0];
  const params = new URLSearchParams(toApiQuery(table, OWN_FILTERS));
  if (tab !== 'ALL') params.set('status', tab);
  const query = params.toString();
  const filtered = OWN_FILTERS.some((key) => table.get(key) !== '');
  const key = `${query}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    apiFetch<PageResult<AdminSellerView>>(`/admin/sellers?${query}`)
      .then((page) => !cancelled && setLoaded({ key, page }))
      .catch((error: unknown) => {
        console.error('Could not load seller applications', error);
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

  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });
  const badge = (seller: AdminSellerView) => <StatusBadge status={seller.status} label={tSeller(`status.${seller.status}`)} />;

  const columns: Column<AdminSellerView>[] = [
    { key: 'shop', header: t('columns.shop'), className: 'font-medium', cell: (seller) => seller.displayName },
    {
      key: 'owner',
      header: t('columns.owner'),
      cell: (seller) => (
        <span>
          {seller.user.name}
          <span className="block text-xs text-muted">{seller.user.email}</span>
        </span>
      ),
    },
    { key: 'location', header: t('location'), cell: (seller) => seller.qcZone?.name ?? <span className="text-muted">{t('noLocation')}</span> },
    { key: 'applied', header: t('appliedOn'), className: 'whitespace-nowrap', cell: (seller) => when(seller.createdAt) },
    { key: 'status', header: t('columns.status'), cell: badge },
  ];

  const card = (seller: AdminSellerView) => (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-text">{seller.displayName}</span>
        {badge(seller)}
      </div>
      <p className="mt-1 text-sm text-muted">
        {seller.user.name} · {seller.qcZone?.name ?? t('noLocation')}
      </p>
      <p className="mt-0.5 text-sm text-muted">
        {t('appliedOn')}: {when(seller.createdAt)}
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
    <DataTable
      rows={result?.items ?? null}
      failed={failed}
      onRetry={() => setAttempt((n) => n + 1)}
      columns={columns}
      rowKey={(seller) => seller.id}
      expand={(seller) => <SellerReviewPanel seller={seller} onDone={() => setAttempt((n) => n + 1)} />}
      card={card}
      total={result?.total ?? 0}
      page={table.page}
      size={table.size}
      onPage={(next) => table.set({ page: next })}
      onSize={(next) => table.set({ size: next === DEFAULT_PAGE_SIZE ? '' : next, page: 1 })}
      filtered={filtered}
      tabs={
        <StatusTabs
          label={t('sellersTabsLabel')}
          active={tab}
          onChange={(next) => table.set({ tab: next === TABS[0] ? '' : next })}
          tabs={TABS.map((status) => ({ key: status, label: t(`filter.${status}`), count: countOf(status) }))}
        />
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onSearch={(next) => table.set({ q: next })} placeholder={t('sellersSearchPlaceholder')} />
          <DateRangePicker from={from} to={to} onChange={(next) => table.set({ from: next.from, to: next.to })} />
        </div>
      }
      activeFilters={<ActiveFilters filters={chips} onReset={() => table.set({ q: '', from: '', to: '' })} />}
    />
  );
}

/** An opened application: everything needed to decide, and the decision itself. */
function SellerReviewPanel({ seller, onDone }: { seller: AdminSellerView; onDone: () => void }) {
  const t = useTranslations('Admin');
  const tErrors = useTranslations('Errors');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function review(action: 'approve' | 'reject', body?: { reason: string }) {
    setBusy(true);
    setErrors([]);
    try {
      await apiFetch<AdminSellerView>(`/admin/sellers/${seller.id}/${action}`, { method: 'POST', body: body ?? {} });
      onDone();
    } catch (error) {
      // 400 on approve means the seller has not picked a location yet.
      setErrors([action === 'approve' && error instanceof ApiError && error.status === 400 ? t('needsLocation') : tErrors(errorKey(error))]);
      if (error instanceof ApiError && error.status === 409) onDone();
    } finally {
      setBusy(false);
    }
  }

  function onReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    void review('reject', { reason });
  }

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <div>
          <dt className="text-muted">{t('contact')}</dt>
          <dd className="mt-0.5 break-all text-text">
            {seller.user.email}
            {seller.user.phone ? <span className="block">{seller.user.phone}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t('location')}</dt>
          <dd className="mt-0.5 text-text">{seller.qcZone?.name ?? t('noLocation')}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('qcFee')}</dt>
          <dd className="mt-0.5 tabular-nums text-text">{seller.qcZone ? `$${seller.qcZone.feeUsd}` : '—'}</dd>
        </div>
      </dl>

      <div>
        <p className="text-muted">{t('about')}</p>
        <p className="mt-0.5 max-w-[70ch] whitespace-pre-line text-text">{seller.about || t('noAbout')}</p>
      </div>

      {seller.status === 'REJECTED' && seller.rejectionReason ? (
        <p className="text-error">
          {t('rejectedWithReason')} {seller.rejectionReason}
        </p>
      ) : null}

      <FormErrors messages={errors} />

      {rejecting ? (
        <form onSubmit={onReject} className="max-w-xl space-y-3">
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
            <Button type="button" variant="secondary" className="h-10" onClick={() => setRejecting(false)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="danger" className="h-10" disabled={busy}>
              {t('confirmReject')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {seller.status !== 'REJECTED' ? (
            <Button variant="secondary" className="h-10" onClick={() => setRejecting(true)} disabled={busy}>
              {seller.status === 'APPROVED' ? t('revoke') : t('reject')}
            </Button>
          ) : null}
          {seller.status !== 'APPROVED' ? (
            <Button className="h-10" onClick={() => void review('approve')} disabled={busy}>
              {t('approve')}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
