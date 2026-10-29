'use client';

import type { CatalogProduct } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';

/** Texts for a catalog product that cards and the detail page share (price, MOQ, stock, lead time, location). */
export function useCatalogText() {
  const t = useTranslations('Catalog');
  const tProducts = useTranslations('Products');
  const format = useFormatter();

  return {
    /** "$6.80 / kg"; null while the owner has not set an exchange rate. */
    price: (product: CatalogProduct): string | null =>
      product.priceUsd === null
        ? null
        : t('perUnit', {
            price: format.number(Number(product.priceUsd), { style: 'currency', currency: 'USD' }),
            unit: tProducts(`units.${product.unit}`),
          }),
    moq: (product: CatalogProduct): string =>
      t('moq', { qty: format.number(product.moq), unit: tProducts(`units.${product.unit}`) }),
    /** Ready stock shows the stock left, made to order shows the lead time. */
    availability: (product: CatalogProduct): string | null =>
      product.type === 'READY_STOCK' && product.stockQty !== null
        ? t('available', { qty: format.number(product.stockQty), unit: tProducts(`units.${product.unit}`) })
        : product.leadTimeDays !== null
          ? t('leadTime', { days: product.leadTimeDays })
          : null,
    /** Bare values for the "Details" list on the detail page: "20 kg" and "100 kg" / "14 days". */
    moqValue: (product: CatalogProduct): string =>
      `${format.number(product.moq)} ${tProducts(`units.${product.unit}`)}`,
    availabilityValue: (product: CatalogProduct): string | null =>
      product.type === 'READY_STOCK' && product.stockQty !== null
        ? `${format.number(product.stockQty)} ${tProducts(`units.${product.unit}`)}`
        : product.leadTimeDays !== null
          ? t('daysValue', { days: product.leadTimeDays })
          : null,
    location: (location: string | null): string | null => (location ? `${location}, Bali` : null),
  };
}
