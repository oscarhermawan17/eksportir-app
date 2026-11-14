'use client';

import type { PublicSellerProfile } from '@balitrade/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useCatalogText } from '@/components/catalog/catalog-text';
import { ProductCard } from '@/components/catalog/product-card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch } from '@/lib/api';

type State = { key: string; seller: PublicSellerProfile | null; notFound: boolean };

export function SellerPage({ id }: { id: string }) {
  const t = useTranslations('Catalog');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const key = `${id}:${locale}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stateKey = `${key}#${attempt}`;
    apiFetch<PublicSellerProfile>(`/public/sellers/${encodeURIComponent(id)}?locale=${locale}`)
      .then((seller) => !cancelled && setState({ key: stateKey, seller, notFound: false }))
      .catch((error: unknown) => {
        if (cancelled) return;
        const notFound = error instanceof ApiError && error.status === 404;
        if (!notFound) console.error('Could not load seller', error);
        setState({ key: stateKey, seller: null, notFound });
      });
    return () => {
      cancelled = true;
    };
  }, [id, locale, key, attempt]);

  const current = state?.key === `${key}#${attempt}` ? state : null;

  return (
    <div className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-5 text-sm text-muted">
        <Link href="/" className="hover:text-primary hover:underline">
          ← {t('back')}
        </Link>
      </nav>
      {current === null ? (
        <p className="text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : current.seller === null ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className={current.notFound ? 'text-text' : 'text-error'}>
            {current.notFound ? t('sellerNotFound') : t('loadError')}
          </p>
          {current.notFound ? null : (
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {tCommon('retry')}
            </Button>
          )}
        </div>
      ) : (
        <Seller seller={current.seller} />
      )}
    </div>
  );
}

function Seller({ seller }: { seller: PublicSellerProfile }) {
  const t = useTranslations('Catalog');
  const format = useFormatter();
  const text = useCatalogText();
  const location = text.location(seller.location);

  return (
    <div className="space-y-8">
      <header className="rounded-card border border-border bg-card p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-text">{seller.displayName}</h1>
        <p className="mt-1 text-sm text-muted">
          {[location, t('memberSince', { date: format.dateTime(new Date(seller.memberSince), { year: 'numeric', month: 'long' }) })]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <h2 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">{t('about')}</h2>
        <p className="mt-1 max-w-3xl whitespace-pre-line text-text">{seller.about || t('noAbout')}</p>
      </header>

      <section aria-labelledby="seller-products">
        <h2 id="seller-products" className="text-xl font-semibold text-text">
          {t('sellerProducts')}
        </h2>
        {seller.products.length === 0 ? (
          <p className="mt-3 rounded-card border border-border bg-card px-5 py-8 text-center text-muted">{t('noSellerProducts')}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {seller.products.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
