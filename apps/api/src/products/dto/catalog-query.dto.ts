import {
  CATALOG_LIMITS,
  CATEGORY_LIMITS,
  CATEGORY_SLUG_PATTERN,
  PRODUCT_TYPES,
  TRANSLATION_LOCALES,
} from '@balitrade/shared';
import type { ProductCategorySlug, ProductType, TranslationLocale } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** Query of the public product list. Every field is optional. */
export class CatalogQueryDto {
  @IsOptional()
  @IsIn(TRANSLATION_LOCALES)
  locale?: TranslationLocale;

  /** Search words, matched against titles and descriptions in every language. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(CATALOG_LIMITS.searchMax)
  q?: string;

  /**
   * Filter by category slug. An unknown or switched-off slug is not an error here — it simply matches
   * nothing, because `visibleToBuyers` already excludes products in categories that are off.
   */
  @IsOptional()
  @IsString()
  @MaxLength(CATEGORY_LIMITS.slugMax)
  @Matches(CATEGORY_SLUG_PATTERN)
  category?: ProductCategorySlug;

  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: ProductType;
}

export class LocaleQueryDto {
  @IsOptional()
  @IsIn(TRANSLATION_LOCALES)
  locale?: TranslationLocale;
}
