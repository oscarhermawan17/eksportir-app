'use client';

import { ProductStatus, type ProductView } from '@balitrade/shared';
import { Search } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { Button, buttonClasses } from '@/components/ui/button';
import { ProductStatusBadge, ProductWarningBadge } from '@/components/ui/product-status-badge';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import { useTableQuery } from '@/lib/table-query';

/**
 * Chip order follows how a seller thinks about their shop — what is selling, what is waiting on us,
 * what is waiting on them — not the order the statuses happen to be declared in.
 */
const FILTERS: ProductStatus[] = [
  ProductStatus.APPROVED,
  ProductStatus.PENDING_REVIEW,
  ProductStatus.REJECTED,
  ProductStatus.DRAFT,
  ProductStatus.ARCHIVED,
];

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
  // Filter and search live in the URL, like the admin tables and the catalog: the view survives a
  // refresh and the Back button, and the top bar's search box can simply link here with ?q=.
  const query = useTableQuery();
  const searchId = useId();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  // What is typed in the mobile search box; the URL stays the source of truth for what is filtered.
  const [text, setText] = useState(query.get('q'));

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
    return (
      <div className="flex-1 animate-pulse space-y-4" aria-busy="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-28 rounded-card border border-border bg-card" />
        ))}
      </div>
    );
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
      <div className="flex flex-1 flex-col items-start gap-3" role="alert">
        <p className="text-error">{t('loadError')}</p>
        <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  const status = query.get('status');
  const search = query.get('q').toLowerCase();
  // Filtering happens here rather than on the server: /seller/products returns one seller's whole list
  // and has no paging, so this is instant and costs no request. If a seller ever has hundreds of
  // listings, both the paging and this filter belong in the API.
  const shown = state.products.filter(
    (product) =>
      (status === '' || product.status === status) &&
      (search === '' ||
        product.title.toLowerCase().includes(search) ||
        product.categoryName.toLowerCase().includes(search)),
  );
  const countOf = (value: ProductStatus) => state.products.filter((product) => product.status === value).length;

  // No heading and no container: the seller shell's top bar is the page title and supplies the width.
  return (
    <div className="flex-1">
      <div className="flex flex-wrap items-center gap-3">
        {/*
          Only below md: from there up the shell's top bar carries the same search, so showing both
          would be two fields for one job.
        */}
        <form
          role="search"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            query.set({ q: text.trim() });
          }}
          className="relative min-w-0 flex-1 md:hidden"
        >
          <label htmlFor={searchId} className="sr-only">
            {t('searchLabel')}
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          {/* Searching on submit, not per keystroke: each search writes to the URL, and one history
              entry per letter typed would bury the Back button. */}
          <input
            id={searchId}
            type="search"
            value={text}
            maxLength={100}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-11 w-full rounded-button border border-border bg-card pl-9 pr-3 text-sm font-medium text-text transition placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </form>
        <Link href="/seller/products/new" className={buttonClasses('primary', 'ml-auto')}>
          {t('newProduct')}
        </Link>
      </div>

      {/* A chip per status with its count, scrollable sideways on a phone rather than wrapping to three rows. */}
      <div className="no-scrollbar -mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <Chip active={status === ''} onClick={() => query.set({ status: '' })}>
            {t('filter.all')} ({state.products.length})
          </Chip>
          {FILTERS.map((value) => (
            <Chip key={value} active={status === value} onClick={() => query.set({ status: value })}>
              {t(`status.${value}`)} ({countOf(value)})
            </Chip>
          ))}
        </div>
      </div>

      {actionError ? (
        <p role="alert" className="mt-4 rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {actionError}
        </p>
      ) : null}

      {state.products.length === 0 ? (
        <p className="mt-6 rounded-card border border-border bg-card px-5 py-8 text-center text-muted">{t('empty')}</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 rounded-card border border-border bg-card px-5 py-8 text-center text-muted">{t('noMatches')}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {shown.map((product) => {
            const cover = product.media.find((item) => item.type === 'IMAGE');
            const actions = (
              <>
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
              </>
            );
            return (
              <li key={product.id} className="rounded-card border border-border bg-card p-4 shadow-sm">
                <div className="flex gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-button bg-background sm:h-20 sm:w-20">
                    {cover?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
                      <img src={cover.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-text">{product.title}</h2>
                      <ProductStatusBadge status={product.status} label={t(`status.${product.status}`)} />
                      {/* An admin switched this category off: the listing is out of the shop even though
                          its status still says APPROVED. Saying so beats letting the seller wonder. */}
                      {!product.categoryActive ? <ProductWarningBadge>{t('categoryDisabled')}</ProductWarningBadge> : null}
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
                  </div>
                  {/* From md the buttons sit in their own column, so the rows line up like a table. */}
                  <div className="hidden shrink-0 flex-col items-stretch gap-2 md:flex">{actions}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 md:hidden">{actions}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active ? 'border-primary bg-primary text-white' : 'border-border bg-card text-muted hover:border-primary hover:text-primary'
      }`}
    >
      {children}
    </button>
  );
}
