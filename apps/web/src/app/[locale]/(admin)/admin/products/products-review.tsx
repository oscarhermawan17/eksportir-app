'use client';

import { DEFAULT_PAGE_SIZE, LISTING_STATUS_TABS, type AdminProductView, type ListingStatusTab, type PageResult } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { DataTable, type Column } from '@/components/admin/data-table';
import { DateRangePicker, useRangeLabel } from '@/components/admin/date-range-picker';
import { StatusTabs } from '@/components/admin/status-tabs';
import { ActiveFilters, SearchBox, type ActiveFilter } from '@/components/admin/table-filters';
import { ProductStatusBadge } from '@/components/ui/product-status-badge';
import { apiFetch } from '@/lib/api';
import { toApiQuery, useTableQuery } from '@/lib/table-query';


/** The filters this list adds to the shared page/size state; all of them live in the URL. */
const OWN_FILTERS = ['status', 'q', 'from', 'to', 'dateField'];

export function ProductsReview() {
  return (
    <LoginGate allow={(user) => user.roles.includes('ADMIN_OPS') || user.roles.includes('ADMIN_OWNER')}>
      {() => <ReviewList />}
    </LoginGate>
  );
}

function ReviewList() {
  const t = useTranslations('AdminProducts');
  const tProducts = useTranslations('Products');
  const tTable = useTranslations('Table');
  const format = useFormatter();
  const rangeLabel = useRangeLabel();
  const table = useTableQuery();

  const [attempt, setAttempt] = useState(0);
  // Keyed by the request it belongs to, the same way the storefront catalog does it: a result for an
  // older query then reads as "still loading" instead of flashing stale rows, and the effect never has
  // to call setState synchronously to clear the previous page.
  const [loaded, setLoaded] = useState<{ key: string; page: PageResult<AdminProductView> | null } | null>(null);

  const status = table.get('status');
  const filter: ListingStatusTab = (LISTING_STATUS_TABS as readonly string[]).includes(status) ? (status as ListingStatusTab) : 'ALL';
  const query = toApiQuery(table, OWN_FILTERS);
  const filtered = OWN_FILTERS.some((key) => table.get(key) !== '');
  const key = `${query}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    apiFetch<PageResult<AdminProductView>>(`/admin/products?${query}`)
      .then((page) => !cancelled && setLoaded({ key, page }))
      .catch((error: unknown) => {
        console.error('Could not load products for review', error);
        if (!cancelled) setLoaded({ key, page: null });
      });
    return () => {
      cancelled = true;
    };
  }, [query, key]);

  const current = loaded?.key === key ? loaded : null;
  const result = current?.page ?? null;
  const failed = current !== null && current.page === null;
  // The last counts received stay on the tabs while the next page loads, so the numbers do not flicker.
  const counts = (current?.page ?? loaded?.page)?.statusCounts;
  const countOf = (tab: ListingStatusTab) =>
    counts === undefined ? undefined : tab === 'ALL' ? Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0) : (counts[tab] ?? 0);

  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: 'medium' }) : '—';

  const titleOf = (product: AdminProductView) => product.translations[product.sourceLocale]?.title ?? '';
  const coverOf = (product: AdminProductView) => product.media.find((item) => item.type === 'IMAGE');

  const photo = (product: AdminProductView) => {
    const cover = coverOf(product);
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-button bg-surface text-[10px] text-muted">
        {cover?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
          <img src={cover.url} alt="" className="h-full w-full object-cover" />
        ) : (
          t('noPhoto')
        )}
      </div>
    );
  };

  const statusBadge = (product: AdminProductView) => (
    <ProductStatusBadge status={product.status} label={tProducts(`status.${product.status}`)} />
  );

  const columns: Column<AdminProductView>[] = [
    {
      key: 'title',
      header: t('columnListing'),
      cell: (product) => (
        <div className="flex items-center gap-3">
          {photo(product)}
          <span className="font-medium text-text">{titleOf(product)}</span>
        </div>
      ),
    },
    { key: 'seller', header: t('seller'), cell: (product) => product.seller.displayName },
    { key: 'category', header: t('columnCategory'), cell: (product) => product.categoryName },
    {
      key: 'price',
      header: t('columnPrice'),
      className: 'text-right tabular-nums',
      cell: (product) => `IDR ${format.number(product.priceIdr)}`,
    },
    { key: 'status', header: t('columnStatus'), cell: statusBadge },
    {
      key: 'reviewed',
      header: t('columnReviewed'),
      className: 'whitespace-nowrap',
      cell: (product) => date(product.reviewedAt ?? null),
    },
  ];

  /** On a phone an admin is triaging, so a card carries only what decides whether to open it. */
  const card = (product: AdminProductView) => (
    <div className="flex gap-3">
      {photo(product)}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-semibold text-text">{titleOf(product)}</h3>
          {statusBadge(product)}
        </div>
        <p className="mt-1 text-sm text-muted">
          {product.seller.displayName} · {product.categoryName}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {t('columnReviewed')}: {date(product.reviewedAt ?? null)}
        </p>
      </div>
    </div>
  );

  const tabs = (
    <StatusTabs
      label={t('tabsLabel')}
      active={filter}
      onChange={(next) => table.set({ status: next === 'ALL' ? '' : next })}
      tabs={LISTING_STATUS_TABS.map((tab) => ({ key: tab, label: t(`filter.${tab}`), count: countOf(tab) }))}
    />
  );

  const dateField = table.get('dateField') || 'createdAt';
  const dateOptions = [
    { value: 'createdAt', label: tTable('dateCreated') },
    { value: 'reviewedAt', label: tTable('dateReviewed') },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <SearchBox value={table.get('q')} onSearch={(next) => table.set({ q: next })} placeholder={t('searchPlaceholder')} />
      <DateRangePicker
        from={table.get('from')}
        to={table.get('to')}
        which={{ value: dateField, options: dateOptions }}
        onChange={({ from, to, which }) =>
          table.set({ from, to, dateField: !from && !to ? '' : which === 'createdAt' ? '' : which })
        }
      />
    </div>
  );

  const q = table.get('q');
  const from = table.get('from');
  const to = table.get('to');
  const chips: ActiveFilter[] = [
    ...(q ? [{ key: 'q', label: tTable('searchFilter', { q }), onRemove: () => table.set({ q: '' }) }] : []),
    ...(from || to
      ? [
          {
            key: 'date',
            label: `${dateOptions.find((o) => o.value === dateField)?.label ?? ''}: ${rangeLabel(from, to)}`,
            onRemove: () => table.set({ from: '', to: '', dateField: '' }),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      rows={result?.items ?? null}
      failed={failed}
      onRetry={() => setAttempt((n) => n + 1)}
      columns={columns}
      rowKey={(product) => product.id}
      card={card}
      total={result?.total ?? 0}
      page={table.page}
      size={table.size}
      onPage={(next) => table.set({ page: next })}
      onSize={(next) => table.set({ size: next === DEFAULT_PAGE_SIZE ? '' : next, page: 1 })}
      filtered={filtered}
      rowHref={(product) => `/admin/products/${product.id}`}
      tabs={tabs}
      toolbar={toolbar}
      activeFilters={<ActiveFilters filters={chips} onReset={() => table.set({ q: '', from: '', to: '', dateField: '' })} />}
    />
  );
}
