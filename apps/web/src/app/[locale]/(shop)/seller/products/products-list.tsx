'use client';

import type { ProductStatus, ProductView } from '@balitrade/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

const STATUS_TONES: Record<ProductStatus, string> = {
  DRAFT: 'bg-muted/10 text-muted border-muted/30',
  PENDING_REVIEW: 'bg-warning/15 text-[#8a5a00] border-warning/40',
  APPROVED: 'bg-success/10 text-success border-success/30',
  REJECTED: 'bg-error/10 text-error border-error/30',
  ARCHIVED: 'bg-muted/10 text-muted border-muted/30',
};

type State = { kind: 'loading' } | { kind: 'forbidden' } | { kind: 'error' } | { kind: 'ready'; products: ProductView[] };

export function ProductsList() {
  return <LoginGate>{() => <Products />}</LoginGate>;
}

function Products() {
  const t = useTranslations('Products');
  const tErrors = useTranslations('Errors');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // ?locale= so each listing comes back with its category's label in this language (T26).
    apiFetch<ProductView[]>(`/seller/products?locale=${locale}`)
      .then((products) => !cancelled && setState({ kind: 'ready', products }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 403) {
          setState({ kind: 'forbidden' });
        } else {
          console.error('Could not load products', error);
          setState({ kind: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, locale]);

  async function act(product: ProductView, action: 'submit' | 'archive' | 'restore') {
    setActionError(null);
    try {
      const updated = await apiFetch<ProductView>(`/seller/products/${product.id}/${action}`, { method: 'POST' });
      setState((current) =>
        current.kind === 'ready'
          ? { kind: 'ready', products: current.products.map((p) => (p.id === updated.id ? updated : p)) }
          : current,
      );
    } catch (error) {
      setActionError(
        error instanceof ApiError && error.status === 400 && action === 'submit'
          ? t('form.needPhoto')
          : tErrors(errorKey(error)),
      );
    }
  }

  if (state.kind === 'loading') {
    return <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12" aria-busy="true" />;
  }
  if (state.kind === 'forbidden') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="text-text">{t('notApproved')}</p>
        <Link href="/seller" className={buttonClasses('primary')}>
          {t('goToSeller')}
        </Link>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start gap-3 px-4 py-12" role="alert">
        <p className="text-error">{t('loadError')}</p>
        <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">{t('title')}</h1>
        <Link href="/seller/products/new" className={buttonClasses('primary')}>
          {t('newProduct')}
        </Link>
      </div>

      {actionError ? (
        <p role="alert" className="mt-4 rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {actionError}
        </p>
      ) : null}

      {state.products.length === 0 ? (
        <p className="mt-6 rounded-card border border-border bg-card px-5 py-8 text-center text-muted">{t('empty')}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {state.products.map((product) => {
            const cover = product.media.find((item) => item.type === 'IMAGE');
            return (
              <li key={product.id} className="flex gap-4 rounded-card border border-border bg-card p-4 shadow-sm">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-button bg-background">
                  {cover?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
                    <img src={cover.url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-text">{product.title}</h2>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_TONES[product.status]}`}
                    >
                      {t(`status.${product.status}`)}
                    </span>
                    {/* An admin switched this category off: the listing is out of the shop even though
                        its status still says APPROVED. Saying so beats letting the seller wonder. */}
                    {!product.categoryActive ? (
                      <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
                        {t('categoryDisabled')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {t(`types.${product.type}`)} · {product.categoryName} · {t('price')}{' '}
                    {format.number(product.priceIdr)} / {t(`units.${product.unit}`)} · {t('moqLabel')} {product.moq}
                    {product.stockQty !== null ? ` · ${t('stockLabel')} ${product.stockQty}` : ''}
                    {product.leadTimeDays !== null ? ` · ${t('leadTimeLabel')} ${product.leadTimeDays} ${t('days')}` : ''}
                  </p>
                  {product.status === 'REJECTED' && product.rejectionReason ? (
                    <p className="mt-2 text-sm text-error">
                      {t('rejectionReason')} {product.rejectionReason}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.status !== 'ARCHIVED' ? (
                      <Link href={`/seller/products/${product.id}/edit`} className={buttonClasses('secondary', 'h-9')}>
                        {t('actions.edit')}
                      </Link>
                    ) : null}
                    {product.status === 'DRAFT' || product.status === 'REJECTED' ? (
                      <Button className="h-9" onClick={() => void act(product, 'submit')}>
                        {t('actions.submit')}
                      </Button>
                    ) : null}
                    {product.status === 'ARCHIVED' ? (
                      <Button variant="secondary" className="h-9" onClick={() => void act(product, 'restore')}>
                        {t('actions.restore')}
                      </Button>
                    ) : (
                      <Button variant="ghost" className="h-9" onClick={() => void act(product, 'archive')}>
                        {t('actions.archive')}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
