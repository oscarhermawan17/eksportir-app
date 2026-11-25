'use client';

import type { CatalogProduct } from '@balitrade/shared';
import { ImageOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCatalogText } from './catalog-text';
import { TypeBadge } from './type-badge';

/**
 * A flat card (design system v2): the photo carries it, the text sits under it with no frame or shadow.
 * `priority` is for the first row, which is on screen when the page loads.
 */
export function ProductCard({ product, priority = false }: { product: CatalogProduct; priority?: boolean }) {
  const t = useTranslations('Catalog');
  const tProducts = useTranslations('Products');
  const text = useCatalogText();
  const cover = product.media.find((item) => item.type === 'IMAGE' && item.url);
  const price = text.price(product);
  const availability = text.availability(product);

  return (
    <article className="group flex w-full min-w-0 flex-col">
      {/* The photo link is a duplicate of the title link, so it is hidden from Tab and screen readers.
          The media is positioned, not in flow: a portrait shot must not make one card taller than its row. */}
      <Link
        href={`/products/${product.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-card bg-surface"
      >
        {cover?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
          <img
            src={cover.url}
            alt=""
            width={400}
            height={300}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-90"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-muted">
            <ImageOff className="h-6 w-6" aria-hidden="true" />
            {t('noPhoto')}
          </span>
        )}
        {/* A hairline inside the photo, so a white product shot still has an edge against the white page. */}
        <span className="pointer-events-none absolute inset-0 rounded-card ring-1 ring-black/5 ring-inset" />
      </Link>

      <div className="flex flex-1 flex-col pt-3">
        {/* Two lines at most: a long title must not make one card taller than the rest of its row. */}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium text-text sm:text-[15px]">
          <Link
            href={`/products/${product.id}`}
            className="rounded-sm hover:underline hover:underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {product.title}
          </Link>
        </h3>
        <TypeBadge type={product.type} label={tProducts(`types.${product.type}`)} className="mt-1" />
        <p className="mt-auto pt-2 text-[15px] font-semibold tabular-nums text-text sm:text-base">
          {price ?? <span className="font-normal text-muted">{t('noPrice')}</span>}
        </p>
        {availability ? <p className="mt-0.5 text-[13px] tabular-nums text-muted">{availability}</p> : null}
        <p className="mt-1 truncate text-[13px] text-muted">
          <Link
            href={`/sellers/${product.seller.id}`}
            className="rounded-sm hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {product.seller.displayName}
          </Link>
        </p>
      </div>
    </article>
  );
}
