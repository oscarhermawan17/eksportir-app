import { CATEGORY_ICON_NAMES } from '@balitrade/shared';
import type { CategoryIconName, ProductCategoryView, TranslationLocale } from '@balitrade/shared';

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

/**
 * The stored icon name, if it is still on the list. A name dropped from CATEGORY_ICON_NAMES later reads as
 * null (the default icon) instead of reaching the web as something it cannot draw.
 */
export function categoryIcon(value: string | null): CategoryIconName | null {
  return value !== null && (CATEGORY_ICON_NAMES as readonly string[]).includes(value) ? (value as CategoryIconName) : null;
}

export function toCategoryView(row: CategoryLabels & { icon: string | null }, locale: TranslationLocale): ProductCategoryView {
  return { slug: row.slug, name: categoryLabel(row, locale), icon: categoryIcon(row.icon) };
}
