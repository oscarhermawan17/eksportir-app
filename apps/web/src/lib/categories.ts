import type { ProductCategoryView } from '@balitrade/shared';
import { apiFetch } from '@/lib/api';

/**
 * The categories a buyer may filter by and a seller may choose from, labelled in one language.
 *
 * Since T26 these are rows the owner manages at /admin/categories, so there is no constant to map over
 * and no `Products.categories` key in the message files any more: a category the owner adds has to show
 * up without a deploy. Lists of products do not need this — a product carries its own `categoryName`.
 */
export function fetchCategories(locale: string): Promise<ProductCategoryView[]> {
  return apiFetch<ProductCategoryView[]>(`/categories?locale=${encodeURIComponent(locale)}`);
}
