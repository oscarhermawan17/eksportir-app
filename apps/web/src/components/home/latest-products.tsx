'use client';

import type { CatalogProduct } from '@balitrade/shared';
import { Coffee, Palette, Shirt, ShoppingBag } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ProductCard } from '@/components/catalog/product-card';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

type State = { key: string; products: CatalogProduct[] | null };

/** The newest catalog products for the home page; `products` is null when loading failed. */
function useLatestProducts(): { products: CatalogProduct[] | null; loading: boolean } {
  const locale = useLocale();
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<CatalogProduct[]>(`/products?locale=${locale}`)
      .then((products) => !cancelled && setState({ key: locale, products }))
      .catch((error: unknown) => {
        console.error('Could not load products for the home page', error);
        if (!cancelled) setState({ key: locale, products: null });
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const current = state?.key === locale ? state : null;
  return { products: current?.products ?? null, loading: current === null };
}

const FALLBACK_TILES = [
  { Icon: Coffee, tone: 'bg-primary/10 text-primary' },
  { Icon: ShoppingBag, tone: 'bg-gold/20 text-gold-text' },
  { Icon: Palette, tone: 'bg-terracotta/10 text-terracotta' },
  { Icon: Shirt, tone: 'bg-info/10 text-info' },
];

/** Hero collage: photos of real products when there are some, decorative tiles otherwise. */
export function HeroCollage() {
  const { products } = useLatestProducts();
  const photos = (products ?? [])
    .map((product) => product.media.find((item) => item.type === 'IMAGE' && item.url)?.url)
    .filter((url): url is string => Boolean(url))
    .slice(0, 4);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4" aria-hidden="true">
      {FALLBACK_TILES.map(({ Icon, tone }, index) => {
        const photo = photos[index];
        return (
          <div
            key={index}
            className={`aspect-square overflow-hidden rounded-card border border-border shadow-sm ${index % 2 === 1 ? 'mt-6' : ''} ${photo ? 'bg-card' : tone}`}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Icon className="h-12 w-12 opacity-70" strokeWidth={1.5} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function FeaturedProducts() {
  const t = useTranslations('Home');
  const { products, loading } = useLatestProducts();
  const latest = products?.slice(0, 8) ?? [];

  return (
    <section aria-labelledby="featured-title" className="mx-auto w-full max-w-6xl px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="featured-title" className="text-2xl font-bold text-text sm:text-3xl">
          {t('featuredTitle')}
        </h2>
        <Link href="/products" className="text-sm font-semibold text-primary hover:underline">
          {t('viewAll')} →
        </Link>
      </div>
      <div className="mt-6">
        {loading ? (
          <p className="text-muted" aria-busy="true">
            …
          </p>
        ) : products === null ? (
          <p role="alert" className="text-error">
            {t('featuredError')}
          </p>
        ) : latest.length === 0 ? (
          <p className="rounded-card border border-border bg-card px-5 py-10 text-center text-muted">{t('featuredEmpty')}</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {latest.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {latest.length > 0 ? (
        <div className="mt-8 text-center">
          <Link href="/products" className={buttonClasses('secondary')}>
            {t('viewAll')}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
