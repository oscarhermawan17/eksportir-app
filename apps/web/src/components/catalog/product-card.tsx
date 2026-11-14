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

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-card border border-border bg-card shadow-sm transition hover:shadow-md">
      {/* The badge sits over the photo, so it needs a positioned parent of its own — it must stay
          outside the link, which is aria-hidden and skipped by Tab. */}
      <div className="relative shrink-0">
        {/* The media is positioned, not in flow: as a flex item this box would otherwise take its height
            from the photo (a portrait shot made the card half as tall again) instead of from the ratio. */}
        <Link
          href={`/products/${product.id}`}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block aspect-[4/3] w-full overflow-hidden bg-background"
        >
          {cover?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
            <img src={cover.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-muted">
              <ImageOff className="h-6 w-6" aria-hidden="true" />
              {t('noPhoto')}
            </span>
          )}
        </Link>
        <span className="pointer-events-none absolute right-2 top-2 max-w-[calc(100%-1rem)]">
          <TypeBadge onImage type={product.type} label={tProducts(`types.${product.type}`)} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        {/* Two lines at most, then an ellipsis: cards sit in a grid, so a long title must not make one
            of them taller than the rest of its row. */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-text sm:text-base">
          <Link href={`/products/${product.id}`} className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
            {product.title}
          </Link>
        </h3>
        {/* Same size as the title, only bold: the price is the other thing a buyer scans for, and the
            two of them carry the card. The minimum order moved to the product page — on a card it was
            a line of small print under every single listing. */}
        <p className="mt-auto pt-1.5 text-sm font-bold tabular-nums text-text sm:text-base">
          {price ?? <span className="font-medium text-muted">{t('noPrice')}</span>}
        </p>
        {availability ? <p className="text-xs text-muted sm:text-sm">{availability}</p> : null}
        {/* The shop closes the card rather than sitting under the title: what a buyer scans for is the
            product and its price. The regency is left out entirely — BaliTrade ships from Bali either
            way, so it told a buyer nothing and cost a line on a narrow card. */}
        <p className="truncate border-t border-border pt-2 text-xs text-muted">
          <Link href={`/sellers/${product.seller.id}`} className="hover:text-primary hover:underline">
            {product.seller.displayName}
          </Link>
        </p>
      </div>
    </article>
  );
}
