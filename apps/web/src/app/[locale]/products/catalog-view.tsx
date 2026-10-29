'use client';

import { PRODUCT_CATEGORIES, PRODUCT_TYPES } from '@balitrade/shared';
import type { CatalogProduct, ProductCategory, ProductType } from '@balitrade/shared';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ProductCard } from '@/components/catalog/product-card';
import { Button, buttonClasses } from '@/components/ui/button';
import { inputClasses } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

type Result = { key: string; products: CatalogProduct[] | null };

export function CatalogView() {
  const t = useTranslations('Catalog');
  const tProducts = useTranslations('Products');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  // The URL is the single source of truth: bookmarks and the back button keep working.
  const q = params.get('q')?.trim() ?? '';
  const categoryParam = params.get('category');
  const typeParam = params.get('type');
  const category = PRODUCT_CATEGORIES.find((value) => value === categoryParam) ?? '';
  const type = PRODUCT_TYPES.find((value) => value === typeParam) ?? '';
  const filtered = q !== '' || category !== '' || type !== '';

  const query = new URLSearchParams({ locale });
  if (q) query.set('q', q);
  if (category) query.set('category', category);
  if (type) query.set('type', type);
  const key = query.toString();

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

  function search(next: { q: string; category: ProductCategory | ''; type: ProductType | '' }) {
    const nextQuery: Record<string, string> = {};
    if (next.q) nextQuery.q = next.q;
    if (next.category) nextQuery.category = next.category;
    if (next.type) nextQuery.type = next.type;
    router.replace({ pathname: '/products', query: nextQuery });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    search({
      q: String(data.get('q') ?? '').trim(),
      category: (String(data.get('category') ?? '') as ProductCategory | ''),
      type: (String(data.get('type') ?? '') as ProductType | ''),
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
      <h1 className="text-3xl font-bold text-text">{t('title')}</h1>

      {/* Remounted when the URL changes, so the fields always show the active search. */}
      <form
        key={key}
        ref={formRef}
        onSubmit={onSubmit}
        role="search"
        className="mt-6 grid gap-3 rounded-card border border-border bg-card p-4 shadow-sm sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <div>
          <label htmlFor="catalog-q" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text">
            {t('searchLabel')}
          </label>
          <input
            id="catalog-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            placeholder={t('searchPlaceholder')}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="catalog-category" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text">
            {t('categoryLabel')}
          </label>
          <select
            id="catalog-category"
            name="category"
            defaultValue={category}
            onChange={() => formRef.current?.requestSubmit()}
            className={inputClasses}
          >
            <option value="">{t('allCategories')}</option>
            {PRODUCT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {tProducts(`categories.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="catalog-type" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text">
            {t('typeLabel')}
          </label>
          <select
            id="catalog-type"
            name="type"
            defaultValue={type}
            onChange={() => formRef.current?.requestSubmit()}
            className={inputClasses}
          >
            <option value="">{t('allTypes')}</option>
            {PRODUCT_TYPES.map((value) => (
              <option key={value} value={value}>
                {tProducts(`types.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full sm:w-auto">
            <Search className="h-4 w-4" aria-hidden="true" />
            {t('searchButton')}
          </Button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-sm font-medium text-muted">
          {current?.products ? t('resultCount', { count: current.products.length }) : ''}
        </p>
        {filtered ? (
          <button type="button" onClick={() => search({ q: '', category: '', type: '' })} className={buttonClasses('ghost', 'h-9 px-3')}>
            {t('clear')}
          </button>
        ) : null}
      </div>

      <div className="mt-4">
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
