'use client';

import {
  DEFAULT_PAGE_SIZE,
  ORDER_STATUS_GROUP_KEYS,
  ORDER_STATUS_GROUPS,
  type OrderStatus,
  type OrderStatusGroup,
  type OrderView,
  type PageResult,
} from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { DataTable, type Column } from '@/components/admin/data-table';
import { DateRangePicker, useRangeLabel } from '@/components/admin/date-range-picker';
import { StatusTabs, type StatusTab } from '@/components/admin/status-tabs';
import { ActiveFilters, SearchBox, type ActiveFilter } from '@/components/admin/table-filters';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { apiFetch } from '@/lib/api';
import { toApiQuery, useTableQuery } from '@/lib/table-query';

/** Filters other than the tab; the tab is turned into `status` (or `payout`) below. */
const OWN_FILTERS = ['q', 'from', 'to'];

/**
 * The admin orders table (T27). Deliberately not the storefront's OrdersList: that one shows a person
 * their own handful of orders as roomy cards, which is right for them and wrong here. One component
 * wearing both faces would have to be told which one on every prop.
 */
export function AdminOrdersTable({ statuses, payoutQueue = false }: { statuses?: readonly OrderStatus[]; payoutQueue?: boolean } = {}) {
  return (
    <LoginGate
      allow={(user) =>
        user.roles.includes('ADMIN_OPS') || user.roles.includes('ADMIN_FINANCE') || user.roles.includes('ADMIN_OWNER')
      }
    >
      {() => <OrdersTable statuses={statuses} payoutQueue={payoutQueue} />}
    </LoginGate>
  );
}

/**
 * Three faces, one table, all with the same tabs on top (design system v2, 2026-11-26):
 * - the orders page: a tab per stage of ORDER_STATUS_GROUPS, plus All (the default);
 * - a work queue (`statuses`, the QC and shipping pages): a tab per status of the queue, the first by default;
 * - the payout queue (`payoutQueue`, T20): Unpaid (default) and Paid.
 * The tab lives in the URL as `?tab=`, like every other filter.
 */
function OrdersTable({ statuses, payoutQueue }: { statuses?: readonly OrderStatus[]; payoutQueue: boolean }) {
  const t = useTranslations('Orders');
  const tAdmin = useTranslations('AdminOrders');
  const tTable = useTranslations('Table');
  const format = useFormatter();
  const rangeLabel = useRangeLabel();
  const table = useTableQuery();

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; page: PageResult<OrderView> | null } | null>(null);

  const tabKeys: string[] = payoutQueue ? ['unpaid', 'paid'] : statuses ? [...statuses] : [...ORDER_STATUS_GROUP_KEYS, 'all'];
  const requested = table.get('tab');
  // The orders page opens on All; a queue opens on its first tab.
  const defaultTab = statuses || payoutQueue ? tabKeys[0]! : 'all';
  const tab = tabKeys.includes(requested) ? requested : defaultTab;

  const params = new URLSearchParams(toApiQuery(table, OWN_FILTERS));
  if (payoutQueue) params.set('payout', tab);
  else if (statuses) params.set('status', tab);
  else if (tab !== 'all') params.set('status', ORDER_STATUS_GROUPS[tab as OrderStatusGroup].join(','));
  const query = params.toString();
  const filtered = OWN_FILTERS.some((key) => table.get(key) !== '');
  const key = `${query}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    apiFetch<PageResult<OrderView>>(`/admin/orders?${query}`)
      .then((page) => !cancelled && setLoaded({ key, page }))
      .catch((error: unknown) => {
        console.error('Could not load orders', error);
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
  const sum = (list: readonly string[]) => list.reduce((total, status) => total + (counts?.[status] ?? 0), 0);
  const countOf = (key: string): number | undefined => {
    if (counts === undefined || payoutQueue) return undefined; // the payout split is not a status
    if (statuses) return counts[key] ?? 0;
    if (key === 'all') return Object.values(counts).reduce<number>((total, n) => total + (n ?? 0), 0);
    return sum(ORDER_STATUS_GROUPS[key as OrderStatusGroup]);
  };
  const tabLabel = (key: string) =>
    payoutQueue ? (key === 'paid' ? tAdmin('payoutPaid') : tAdmin('payoutUnpaid')) : statuses ? t(`status.${key}`) : tAdmin(`tabs.${key}`);
  const tabs: StatusTab[] = tabKeys.map((key) => ({ key, label: tabLabel(key), count: countOf(key) }));

  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });

  const columns: Column<OrderView>[] = [
    { key: 'code', header: tAdmin('columnCode'), className: 'whitespace-nowrap font-medium', cell: (order) => order.code },
    { key: 'date', header: tAdmin('columnDate'), className: 'whitespace-nowrap', cell: (order) => when(order.createdAt) },
    { key: 'buyer', header: tAdmin('columnBuyer'), cell: (order) => order.buyer.name },
    { key: 'seller', header: tAdmin('columnSeller'), cell: (order) => order.seller.displayName },
    {
      key: 'qty',
      header: tAdmin('columnItems'),
      className: 'text-right tabular-nums',
      cell: (order) => format.number(order.item.qty),
    },
    {
      key: 'total',
      header: tAdmin('columnTotal'),
      className: 'text-right tabular-nums',
      cell: (order) => money(order.totals.totalUsd),
    },
    {
      key: 'status',
      header: tAdmin('columnStatus'),
      cell: (order) => <OrderStatusBadge status={order.status} label={t(`status.${order.status}`)} />,
    },
  ];

  /** No links inside: the whole card is the link (`rowHref`). */
  const card = (order: OrderView) => (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-text">{order.code}</span>
        <OrderStatusBadge status={order.status} label={t(`status.${order.status}`)} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {order.buyer.name} → {order.seller.displayName}
      </p>
      <p className="mt-0.5 text-sm tabular-nums text-muted">
        {money(order.totals.totalUsd)} · {when(order.createdAt)}
      </p>
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <SearchBox value={table.get('q')} onSearch={(next) => table.set({ q: next })} placeholder={tAdmin('searchPlaceholder')} />
      <DateRangePicker from={table.get('from')} to={table.get('to')} onChange={({ from, to }) => table.set({ from, to })} />
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
      rowKey={(order) => order.id}
      rowHref={(order) => `/admin/orders/${order.id}`}
      card={card}
      total={result?.total ?? 0}
      page={table.page}
      size={table.size}
      onPage={(next) => table.set({ page: next })}
      onSize={(next) => table.set({ size: next === DEFAULT_PAGE_SIZE ? '' : next, page: 1 })}
      filtered={filtered}
      tabs={
        <StatusTabs
          label={tAdmin('tabsLabel')}
          active={tab}
          onChange={(next) => table.set({ tab: next === defaultTab ? '' : next })}
          tabs={tabs}
        />
      }
      toolbar={toolbar}
      activeFilters={<ActiveFilters filters={chips} onReset={() => table.set({ q: '', from: '', to: '' })} />}
    />
  );
}
