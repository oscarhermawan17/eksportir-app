'use client';

import { DEFAULT_PAGE_SIZE, type AdminProductView, type PageResult, type ProductStatus } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { DataTable, type Column } from '@/components/admin/data-table';
import { DateRange, SearchBox } from '@/components/admin/table-filters';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import { toApiQuery, useTableQuery } from '@/lib/table-query';

type Filter = ProductStatus | 'ALL';
const FILTERS: Filter[] = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', 'ALL'];

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
  const table = useTableQuery();

  const [attempt, setAttempt] = useState(0);
  // Keyed by the request it belongs to, the same way the storefront catalog does it: a result for an
  // older query then reads as "still loading" instead of flashing stale rows, and the effect never has
  // to call setState synchronously to clear the previous page.
  const [loaded, setLoaded] = useState<{ key: string; page: PageResult<AdminProductView> | null } | null>(null);

  const status = table.get('status');
  const filter: Filter = (FILTERS as string[]).includes(status) ? (status as Filter) : 'ALL';
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

  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: 'medium' }) : '—';

  const titleOf = (product: AdminProductView) => product.translations[product.sourceLocale]?.title ?? '';
  const coverOf = (product: AdminProductView) => product.media.find((item) => item.type === 'IMAGE');

  const photo = (product: AdminProductView) => {
    const cover = coverOf(product);
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-button bg-background text-[10px] text-muted">
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
    <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted">
      {tProducts(`status.${product.status}`)}
    </span>
  );

  const columns: Column<AdminProductView>[] = [
    {
      key: 'title',
      header: t('columnListing'),
      cell: (product) => (
        <div className="flex items-center gap-3">
          {photo(product)}
          <span className="font-semibold text-text">{titleOf(product)}</span>
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
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (product) => (
        <Link href={`/admin/products/${product.id}`} className={buttonClasses('secondary', 'h-8 px-3')}>
          {t('review')}
        </Link>
      ),
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
        <Link href={`/admin/products/${product.id}`} className={buttonClasses('secondary', 'mt-3 h-9')}>
          {t('review')}
        </Link>
      </div>
    </div>
  );

  const toolbar = (
    <div className="space-y-3">
      <div role="tablist" aria-label={t('title')} className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={filter === option}
            onClick={() => table.set({ status: option === 'ALL' ? '' : option })}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              filter === option ? 'border-primary bg-primary text-white' : 'border-border bg-card text-text hover:border-primary'
            }`}
          >
            {t(`filter.${option}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <SearchBox
          value={table.get('q')}
          onSearch={(next) => table.set({ q: next })}
          placeholder={t('searchPlaceholder')}
        />
        <DateRange
          from={table.get('from')}
          to={table.get('to')}
          onChange={(next) => table.set(next)}
          which={{
            value: table.get('dateField') || 'createdAt',
            onChange: (next) => table.set({ dateField: next === 'createdAt' ? '' : next }),
            options: [
              { value: 'createdAt', label: tTable('dateCreated') },
              { value: 'reviewedAt', label: tTable('dateReviewed') },
            ],
          }}
        />
      </div>
    </div>
  );

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
      toolbar={toolbar}
    />
  );
}
