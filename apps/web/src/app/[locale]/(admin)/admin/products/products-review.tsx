'use client';

import type { AdminProductView, ProductStatus } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

type Filter = ProductStatus | 'ALL';
const FILTERS: Filter[] = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', 'ALL'];

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
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const [filter, setFilter] = useState<Filter>('PENDING_REVIEW');
  const [attempt, setAttempt] = useState(0);
  const [products, setProducts] = useState<AdminProductView[] | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = (next: Filter) => {
    setProducts(null);
    setFailed(false);
    setFilter(next);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminProductView[]>(`/admin/products${filter === 'ALL' ? '' : `?status=${filter}`}`)
      .then((result) => !cancelled && setProducts(result))
      .catch((error: unknown) => {
        console.error('Could not load products for review', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, attempt]);

  return (
    <div>

      <div role="tablist" aria-label={t('title')} className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={filter === option}
            onClick={() => reload(option)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              filter === option ? 'border-primary bg-primary text-white' : 'border-border bg-card text-text hover:border-primary'
            }`}
          >
            {t(`filter.${option}`)}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {failed ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-error">{t('loadError')}</p>
            <Button variant="secondary" onClick={() => reload(filter)}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : products === null ? (
          <p className="text-muted" aria-busy="true">
            {t('loading')}
          </p>
        ) : products.length === 0 ? (
          <p className="rounded-card border border-border bg-card px-5 py-8 text-center text-muted">{t('empty')}</p>
        ) : (
          products.map((product) => {
            const cover = product.media.find((item) => item.type === 'IMAGE');
            const title = product.translations[product.sourceLocale]?.title ?? '';
            return (
              <article key={product.id} className="flex gap-4 rounded-card border border-border bg-card p-4 shadow-sm">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-button bg-background text-xs text-muted">
                  {cover?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
                    <img src={cover.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    t('noPhoto')
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-text">{title}</h2>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted">
                      {tProducts(`status.${product.status}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {t('seller')}: {product.seller.displayName} · {tProducts(`types.${product.type}`)} ·{' '}
                    {product.categoryName} · IDR {format.number(product.priceIdr)} ·{' '}
                    {t('updated')} {format.dateTime(new Date(product.updatedAt), { dateStyle: 'medium' })}
                  </p>
                  <Link href={`/admin/products/${product.id}`} className={buttonClasses('secondary', 'mt-3 h-9')}>
                    {t('review')}
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
