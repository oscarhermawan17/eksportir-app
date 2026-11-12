import type { ProductCategoryView, TranslationLocale } from '@balitrade/shared';

/** The three label columns of a product_categories row. */
export interface CategoryLabels {
  slug: string;
  nameEn: string;
  nameId: string;
  nameRu: string;
}

/**
 * Label of a category in one language. Falls back to English and then to the slug, so a category created
 * before someone got round to translating it still renders something readable instead of an empty chip.
 */
export function categoryLabel(row: CategoryLabels, locale: TranslationLocale): string {
  const byLocale: Record<TranslationLocale, string> = {
    en: row.nameEn,
    id: row.nameId,
    ru: row.nameRu,
  };
  return byLocale[locale]?.trim() || row.nameEn.trim() || row.slug;
}

export function toCategoryView(row: CategoryLabels, locale: TranslationLocale): ProductCategoryView {
  return { slug: row.slug, name: categoryLabel(row, locale) };
}
