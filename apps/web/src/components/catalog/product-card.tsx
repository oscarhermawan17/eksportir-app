'use client';

import type { CatalogProduct } from '@balitrade/shared';
import { ImageOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCatalogText } from './catalog-text';
import { TypeBadge } from './type-badge';

export function ProductCard({ product }: { product: CatalogProduct }) {
  const t = useTranslations('Catalog');
  const tProducts = useTranslations('Products');
  const text = useCatalogText();
  const cover = product.media.find((item) => item.type === 'IMAGE' && item.url);
  const price = text.price(product);
  const availability = text.availability(product);
  const location = text.location(product.seller.location);

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-card border border-border bg-card shadow-sm transition hover:shadow-md">
      <Link href={`/products/${product.id}`} tabIndex={-1} aria-hidden="true" className="relative block aspect-[4/3] bg-background">
        {cover?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
          <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm text-muted">
            <ImageOff className="h-6 w-6" aria-hidden="true" />
            {t('noPhoto')}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <TypeBadge type={product.type} label={tProducts(`types.${product.type}`)} />
        </div>
        <h3 className="line-clamp-2 text-base font-semibold text-text">
          <Link href={`/products/${product.id}`} className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
            {product.title}
          </Link>
        </h3>
        <p className="text-sm text-muted">
          <Link href={`/sellers/${product.seller.id}`} className="hover:text-primary hover:underline">
            {location
              ? t('sellerLine', { seller: product.seller.displayName, location })
              : product.seller.displayName}
          </Link>
        </p>
        <p className="mt-auto pt-2 text-lg font-bold tabular-nums text-text">{price ?? <span className="text-sm font-medium text-muted">{t('noPrice')}</span>}</p>
        <p className="text-sm text-muted">{text.moq(product)}</p>
        {availability ? <p className="text-sm text-muted">{availability}</p> : null}
      </div>
    </article>
  );
}
