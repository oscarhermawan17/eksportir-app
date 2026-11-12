import { CATEGORY_LIMITS, CATEGORY_SLUG_PATTERN, TRANSLATION_LOCALES } from '@balitrade/shared';
import type { TranslationLocale } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateCategoryDto {
  /**
   * Products store this, so it is fixed for the life of the category and the update endpoint does not
   * accept it. Uppercased here so `coffee_tea` typed into the form becomes `COFFEE_TEA` instead of an error.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MaxLength(CATEGORY_LIMITS.slugMax)
  @Matches(CATEGORY_SLUG_PATTERN, { message: 'slug must be SCREAMING_SNAKE_CASE, e.g. COFFEE_TEA' })
  slug: string;

  @Transform(trim)
  @IsString()
  @MinLength(CATEGORY_LIMITS.nameMin)
  @MaxLength(CATEGORY_LIMITS.nameMax)
  nameEn: string;

  @Transform(trim)
  @IsString()
  @MinLength(CATEGORY_LIMITS.nameMin)
  @MaxLength(CATEGORY_LIMITS.nameMax)
  nameId: string;

  @Transform(trim)
  @IsString()
  @MinLength(CATEGORY_LIMITS.nameMin)
  @MaxLength(CATEGORY_LIMITS.nameMax)
  nameRu: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(CATEGORY_LIMITS.sortOrderMax)
  sortOrder?: number;
}

/** Only the fields sent are changed. The slug is absent on purpose: products reference it. */
export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(CATEGORY_LIMITS.nameMin)
  @MaxLength(CATEGORY_LIMITS.nameMax)
  nameEn?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(CATEGORY_LIMITS.nameMin)
  @MaxLength(CATEGORY_LIMITS.nameMax)
  nameId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(CATEGORY_LIMITS.nameMin)
  @MaxLength(CATEGORY_LIMITS.nameMax)
  nameRu?: string;

  /** False hides every product in this category from the shop, without touching their status. */
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** True archives (soft delete), false restores. */
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(CATEGORY_LIMITS.sortOrderMax)
  sortOrder?: number;
}

export class CategoryLocaleQueryDto {
  @IsOptional()
  @IsIn(TRANSLATION_LOCALES)
  locale?: TranslationLocale;
}

/** `?archived=true` on the admin list also shows soft-deleted categories. */
export class AdminCategoryQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  archived?: boolean;
}
