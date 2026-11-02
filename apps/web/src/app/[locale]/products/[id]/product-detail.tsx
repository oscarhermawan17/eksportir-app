'use client';

import type { CatalogProduct } from '@balitrade/shared';
import { ImageOff, MessageCircle, Play, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCatalogText } from '@/components/catalog/catalog-text';
import { ChatDrawer } from '@/components/chat/chat-drawer';
import { OrderDialog } from '@/components/orders/order-dialog';
import { TypeBadge } from '@/components/catalog/type-badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch } from '@/lib/api';

type State = { key: string; product: CatalogProduct | null; notFound: boolean };

export function ProductDetail({ id }: { id: string }) {
  const t = useTranslations('Catalog');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const key = `${id}:${locale}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stateKey = `${key}#${attempt}`;
    apiFetch<CatalogProduct>(`/products/${encodeURIComponent(id)}?locale=${locale}`)
      .then((product) => !cancelled && setState({ key: stateKey, product, notFound: false }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (!(error instanceof ApiError && error.status === 404)) {
          console.error('Could not load product', error);
        }
        setState({ key: stateKey, product: null, notFound: error instanceof ApiError && error.status === 404 });
      });
    return () => {
      cancelled = true;
    };
  }, [id, locale, key, attempt]);

  const current = state?.key === `${key}#${attempt}` ? state : null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
      <nav aria-label={t('title')} className="mb-5 text-sm text-muted">
        <Link href="/products" className="hover:text-primary hover:underline">
          ← {t('back')}
        </Link>
      </nav>
      {current === null ? (
        <p className="text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : current.product === null ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className={current.notFound ? 'text-text' : 'text-error'}>{current.notFound ? t('notFound') : t('loadError')}</p>
          {current.notFound ? null : (
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {tCommon('retry')}
            </Button>
          )}
        </div>
      ) : (
        <Product product={current.product} />
      )}
    </div>
  );
}

function Product({ product }: { product: CatalogProduct }) {
  const t = useTranslations('Catalog');
  const tProducts = useTranslations('Products');
  const locale = useLocale();
  const text = useCatalogText();
  const { user, status } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const price = text.price(product);
  const availability = text.availabilityValue(product);
  const location = text.location(product.seller.location);
  const languageName = t(`languages.${product.textLocale}`);

  return (
    <article className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      {chatOpen ? <ChatDrawer product={product} onClose={() => setChatOpen(false)} /> : null}
      {orderOpen ? <OrderDialog product={product} onClose={() => setOrderOpen(false)} /> : null}
      <Gallery product={product} />

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={product.type} label={tProducts(`types.${product.type}`)} />
          {product.isAuto ? (
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-semibold text-muted">
              {t('autoTranslated')}
            </span>
          ) : product.textLocale !== locale ? (
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-semibold text-muted">
              {t('originalLanguage', { language: languageName })}
            </span>
          ) : null}
        </div>

        <h1 className="text-3xl font-bold text-text">{product.title}</h1>

        <div>
          <p className="text-3xl font-bold tabular-nums text-text">
            {price ?? <span className="text-lg font-medium text-muted">{t('noPrice')}</span>}
          </p>
          {price ? <p className="mt-1 text-sm text-muted">{t('priceNote')}</p> : null}
        </div>

        <dl className="grid grid-cols-2 gap-4 rounded-card border border-border bg-card p-4 text-sm">
          <Fact label={t('minimumOrder')} value={text.moqValue(product)} />
          {availability ? (
            <Fact label={product.type === 'READY_STOCK' ? t('availableStock') : t('leadTimeTitle')} value={availability} />
          ) : null}
          {location ? <Fact label={t('sellerLocation')} value={location} /> : null}
        </dl>

        <p className="text-sm text-muted">{t('shippingNote')}</p>

        <div className="space-y-3">
          {status === 'loading' ? null : user ? (
            <>
              {/* Only buyers can order or ask; admins join conversations from the inbox, sellers answer there. */}
              {user.roles.includes('BUYER') ? (
                <>
                  <Button className="w-full" onClick={() => setOrderOpen(true)} disabled={product.priceUsd === null}>
                    {t('order')}
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={() => setChatOpen(true)}>
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    {t('ask')}
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClasses('primary', 'w-full')}>
                {t('order')}
              </Link>
              <Link href="/login" className={buttonClasses('secondary', 'w-full')}>
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {t('ask')}
              </Link>
              <p className="text-sm text-muted">{t('loginHint')}</p>
            </>
          )}
        </div>

        <ul className="space-y-2 rounded-card border border-gold/40 bg-gold/10 p-4 text-sm text-text">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />
            {t('trustPayment')}
          </li>
          <li className="flex items-start gap-2">
            <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />
            {t('trustQc')}
          </li>
        </ul>
      </div>

      <section aria-labelledby="description" className="lg:col-span-2">
        <h2 id="description" className="text-xl font-semibold text-text">
          {t('descriptionTitle')}
        </h2>
        <p className="mt-3 max-w-3xl whitespace-pre-line text-text">{product.description}</p>
      </section>

      <section aria-labelledby="seller" className="rounded-card border border-border bg-card p-5 shadow-sm lg:col-span-2">
        <h2 id="seller" className="text-xs font-bold uppercase tracking-wider text-muted">
          {t('seller')}
        </h2>
        <p className="mt-1 text-lg font-semibold text-text">{product.seller.displayName}</p>
        {location ? <p className="text-sm text-muted">{location}</p> : null}
        <Link href={`/sellers/${product.seller.id}`} className={buttonClasses('secondary', 'mt-4')}>
          {t('viewSeller')}
        </Link>
      </section>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-text">{value}</dd>
    </div>
  );
}

function Gallery({ product }: { product: CatalogProduct }) {
  const t = useTranslations('Catalog');
  const items = product.media.filter((item) => item.url);
  const [selected, setSelected] = useState(0);
  const active = items[selected] ?? items[0];

  if (!active?.url) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-card border border-border bg-card text-muted">
        <ImageOff className="h-8 w-8" aria-hidden="true" />
        {t('noPhoto')}
      </div>
    );
  }

  return (
    <section aria-label={t('gallery')} className="space-y-3">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-card border border-border bg-black/5">
        {active.type === 'VIDEO' ? (
          <video key={active.url} src={active.url} controls preload="metadata" className="h-full w-full object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
          <img src={active.url} alt={product.title} className="h-full w-full object-contain" />
        )}
      </div>
      {items.length > 1 ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={t('thumbnail', { number: index + 1 })}
                aria-current={index === selected}
                className={`relative h-16 w-16 overflow-hidden rounded-lg border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  index === selected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                }`}
              >
                {item.type === 'VIDEO' ? (
                  <span className="flex h-full w-full flex-col items-center justify-center bg-primary/10 text-primary">
                    <Play className="h-5 w-5" aria-hidden="true" />
                    <span className="sr-only">{t('video')}</span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
                  <img src={item.url!} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
