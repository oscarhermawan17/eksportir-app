'use client';

import { DEFAULT_PAGE_SIZE, OrderStatus, type OrderView, type PageResult } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { DataTable, type Column } from '@/components/admin/data-table';
import { DateRange, SearchBox } from '@/components/admin/table-filters';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import { toApiQuery, useTableQuery } from '@/lib/table-query';

const OWN_FILTERS = ['status', 'q', 'from', 'to'];

/**
 * The admin orders table (T27). Deliberately not the storefront's OrdersList: that one shows a person
 * their own handful of orders as roomy cards, which is right for them and wrong here. One component
 * wearing both faces would have to be told which one on every prop.
 */
export function AdminOrdersTable() {
  return (
    <LoginGate
      allow={(user) =>
        user.roles.includes('ADMIN_OPS') || user.roles.includes('ADMIN_FINANCE') || user.roles.includes('ADMIN_OWNER')
      }
    >
      {() => <OrdersTable />}
    </LoginGate>
  );
}

function OrdersTable() {
  const t = useTranslations('Orders');
  const tAdmin = useTranslations('AdminOrders');
  const format = useFormatter();
  const table = useTableQuery();

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; page: PageResult<OrderView> | null } | null>(null);

  const query = toApiQuery(table, OWN_FILTERS);
  const filtered = OWN_FILTERS.some((key) => table.get(key) !== '');
  const key = `${query}#${attempt}`;
  const status = table.get('status');

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

  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });

  const columns: Column<OrderView>[] = [
    {
      key: 'code',
      header: tAdmin('columnCode'),
      className: 'whitespace-nowrap font-semibold',
      cell: (order) => order.code,
    },
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
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (order) => (
        <Link href={`/admin/orders/${order.id}`} className={buttonClasses('secondary', 'h-8 px-3')}>
          {tAdmin('open')}
        </Link>
      ),
    },
  ];

  const card = (order: OrderView) => (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-text">{order.code}</span>
        <OrderStatusBadge status={order.status} label={t(`status.${order.status}`)} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {order.buyer.name} → {order.seller.displayName}
      </p>
      <p className="mt-0.5 text-sm text-muted">
        {money(order.totals.totalUsd)} · {when(order.createdAt)}
      </p>
      <Link href={`/admin/orders/${order.id}`} className={buttonClasses('secondary', 'mt-3 h-9')}>
        {tAdmin('open')}
      </Link>
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <SearchBox value={table.get('q')} onSearch={(next) => table.set({ q: next })} placeholder={tAdmin('searchPlaceholder')} />
      <label className="flex items-center gap-2 text-sm text-muted">
        {tAdmin('columnStatus')}
        <select
          value={status}
          onChange={(event) => table.set({ status: event.target.value })}
          className="h-9 rounded-button border border-border bg-card px-2 text-sm font-medium text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        >
          <option value="">{tAdmin('allStatuses')}</option>
          {Object.values(OrderStatus).map((option) => (
            <option key={option} value={option}>
              {t(`status.${option}`)}
            </option>
          ))}
        </select>
      </label>
      <DateRange from={table.get('from')} to={table.get('to')} onChange={(next) => table.set(next)} />
    </div>
  );

  return (
    <DataTable
      rows={result?.items ?? null}
      failed={failed}
      onRetry={() => setAttempt((n) => n + 1)}
      columns={columns}
      rowKey={(order) => order.id}
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
