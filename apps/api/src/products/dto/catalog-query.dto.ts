import { CATALOG_LIMITS, PRODUCT_CATEGORIES, PRODUCT_TYPES, TRANSLATION_LOCALES } from '@balitrade/shared';
import type { ProductCategory, ProductType, TranslationLocale } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES)
  category?: ProductCategory;

  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  type?: ProductType;
}

export class LocaleQueryDto {
  @IsOptional()
  @IsIn(TRANSLATION_LOCALES)
  locale?: TranslationLocale;
}
