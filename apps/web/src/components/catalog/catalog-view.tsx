'use client';

import { PRODUCT_TYPES } from '@balitrade/shared';
import type { CatalogProduct, ProductCategorySlug, ProductCategoryView, ProductType } from '@balitrade/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProductCard } from '@/components/catalog/product-card';
import { Button, buttonClasses } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import { fetchCategories } from '@/lib/categories';

type Result = { key: string; products: CatalogProduct[] | null };
type Search = { q: string; category: ProductCategorySlug | ''; type: ProductType | '' };

const CHIP = 'inline-flex h-9 items-center rounded-button border px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CHIP_ON = `${CHIP} border-primary bg-primary text-white`;
const CHIP_OFF = `${CHIP} border-border bg-card text-text hover:border-primary hover:text-primary`;

/** The catalog, which is also the landing page. The search field itself lives in the navbar. */
export function CatalogView() {
  const t = useTranslations('Catalog');
  const tProducts = useTranslations('Products');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  // The URL is the single source of truth: bookmarks and the back button keep working.
  const q = params.get('q')?.trim() ?? '';
  const categoryParam = params.get('category');
  const typeParam = params.get('type');
  // Not checked against a list: categories are rows now (T26), and the API answers an unknown slug with
  // an empty result rather than an error, so a bookmarked filter keeps working after a category goes.
  const category = categoryParam?.trim() ?? '';
  const type = PRODUCT_TYPES.find((value) => value === typeParam) ?? '';
  const filtered = q !== '' || category !== '' || type !== '';

  const query = new URLSearchParams({ locale });
  if (q) query.set('q', q);
  if (category) query.set('category', category);
  if (type) query.set('type', type);
  const key = query.toString();

  // The chips come from the API so a category the owner adds or switches off needs no deploy.
  const [categories, setCategories] = useState<ProductCategoryView[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchCategories(locale)
      .then((rows) => !cancelled && setCategories(rows))
      .catch((error: unknown) => console.error('Could not load categories', error));
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<CatalogProduct[]>(`/products?${key}`)
      .then((products) => !cancelled && setResult({ key: `${key}#${attempt}`, products }))
      .catch((error: unknown) => {
        console.error('Could not load products', error);
        if (!cancelled) setResult({ key: `${key}#${attempt}`, products: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  // A result that belongs to an older search is treated as "still loading".
  const current = result?.key === `${key}#${attempt}` ? result : null;

  function search(next: Search) {
    const nextQuery: Record<string, string> = {};
    if (next.q) nextQuery.q = next.q;
    if (next.category) nextQuery.category = next.category;
    if (next.type) nextQuery.type = next.type;
    router.replace({ pathname: '/', query: nextQuery });
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-bold text-text">{q ? t('resultsFor', { q }) : t('title')}</h1>

      {/* Categories are the main filter, so they are visible rather than hidden in a dropdown. */}
      {/* Narrow screens scroll the row sideways; from sm up there is room to wrap instead. */}
      <nav aria-label={t('categoryLabel')} className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <li>
            <button
              type="button"
              aria-current={category === '' ? 'true' : undefined}
              onClick={() => search({ q, category: '', type })}
              className={category === '' ? CHIP_ON : CHIP_OFF}
            >
              {t('allCategories')}
            </button>
          </li>
          {categories.map(({ slug, name }) => (
            <li key={slug}>
              <button
                type="button"
                aria-current={category === slug ? 'true' : undefined}
                onClick={() => search({ q, category: slug, type })}
                className={category === slug ? CHIP_ON : CHIP_OFF}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-muted" aria-live="polite">
          {current?.products ? t('resultCount', { count: current.products.length }) : ''}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="catalog-type" className="text-sm font-medium text-muted">
            {t('typeLabel')}
          </label>
          <select
            id="catalog-type"
            value={type}
            onChange={(event) => search({ q, category, type: event.target.value as ProductType | '' })}
            className="h-9 rounded-button border border-border bg-card px-3 text-sm font-medium text-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            <option value="">{t('allTypes')}</option>
            {PRODUCT_TYPES.map((value) => (
              <option key={value} value={value}>
                {tProducts(`types.${value}`)}
              </option>
            ))}
          </select>
          {filtered ? (
            <button type="button" onClick={() => search({ q: '', category: '', type: '' })} className={buttonClasses('ghost', 'h-9 px-3')}>
              {t('clear')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        {current === null ? (
          <p className="text-muted" aria-busy="true">
            {t('loading')}
          </p>
        ) : current.products === null ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-error">{t('loadError')}</p>
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : current.products.length === 0 ? (
          <div className="rounded-card border border-border bg-card px-6 py-12 text-center">
            <p className="text-lg font-semibold text-text">{t('emptyTitle')}</p>
            <p className="mt-1 text-muted">{t('emptyText')}</p>
            {filtered ? (
              <Button variant="secondary" className="mt-5" onClick={() => search({ q: '', category: '', type: '' })}>
                {t('clear')}
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {current.products.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
