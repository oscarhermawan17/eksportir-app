'use client';

import type { OrderView } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Link } from '@/i18n/navigation';

/**
 * One order as a clickable card: code, status, what was ordered, the other party and the total.
 * Shared by the orders list and the seller dashboard so the two cannot drift apart.
 *
 * Everything inside is a `span`: the whole card is one link, and a link may not contain block elements.
 */
export function OrderRow({ order, basePath }: { order: OrderView; basePath: string }) {
  const t = useTranslations('Orders');
  const format = useFormatter();
  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });

  return (
    <Link
      href={`${basePath}/${order.id}`}
      className="block rounded-card border border-border bg-card p-4 shadow-sm transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-base font-semibold text-text">{order.code}</span>
          <OrderStatusBadge status={order.status} label={t(`status.${order.status}`)} />
        </span>
        <span className="text-xs text-muted">{format.dateTime(new Date(order.createdAt), { dateStyle: 'medium' })}</span>
      </span>
      <span className="mt-2 block text-sm text-text">{t('listLine', { qty: format.number(order.item.qty), title: order.item.title })}</span>
      <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>
          {order.viewer === 'BUYER'
            ? t('sellerLine', { name: order.seller.displayName })
            : order.viewer === 'SELLER'
              ? t('buyerLine', { name: order.buyer.name })
              : `${t('buyerLine', { name: order.buyer.name })} · ${t('sellerLine', { name: order.seller.displayName })}`}
        </span>
        <span className="font-semibold tabular-nums text-text">
          {t('total')}: {money(order.totals.totalUsd)}
        </span>
      </span>
    </Link>
  );
}
