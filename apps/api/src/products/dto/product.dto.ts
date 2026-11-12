import {
  CATEGORY_LIMITS,
  CATEGORY_SLUG_PATTERN,
  PRODUCT_LIMITS,
  PRODUCT_TYPES,
  PRODUCT_UNITS,
  SOURCE_LOCALES,
} from '@balitrade/shared';
import type {
  ProductCategorySlug,
  ProductType,
  ProductUnit,
  SourceLocale,
} from '@balitrade/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class ProductMediaItemDto {
  @IsString()
  @MaxLength(200)
  key: string;
}

/** Used for both create and update (update replaces the whole listing). */
export class ProductDto {
  @IsIn(PRODUCT_TYPES)
  type: ProductType;

  /**
   * A category slug. Only the shape is checked here: since T26 categories are rows, so whether this one
   * exists and is switched on is decided against the database in ProductsService.
   */
  @IsString()
  @MaxLength(CATEGORY_LIMITS.slugMax)
  @Matches(CATEGORY_SLUG_PATTERN)
  category: ProductCategorySlug;

  @IsIn(PRODUCT_UNITS)
  unit: ProductUnit;

  @IsInt()
  @Min(1)
  @Max(PRODUCT_LIMITS.priceIdrMax)
  priceIdr: number;

  @IsInt()
  @Min(1)
  @Max(PRODUCT_LIMITS.moqMax)
  moq: number;

  /** Required for READY_STOCK, ignored for MADE_TO_ORDER. */
  @ValidateIf((product: ProductDto) => product.type === 'READY_STOCK')
  @IsInt()
  @Min(0)
  @Max(PRODUCT_LIMITS.stockMax)
  stockQty?: number;

  /** Required for MADE_TO_ORDER, ignored for READY_STOCK. */
  @ValidateIf((product: ProductDto) => product.type === 'MADE_TO_ORDER')
  @IsInt()
  @Min(1)
  @Max(PRODUCT_LIMITS.leadTimeDaysMax)
  leadTimeDays?: number;

  @IsIn(SOURCE_LOCALES)
  sourceLocale: SourceLocale;

  @Transform(trim)
  @IsString()
  @MinLength(PRODUCT_LIMITS.titleMin)
  @MaxLength(PRODUCT_LIMITS.titleMax)
  title: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(PRODUCT_LIMITS.descriptionMax)
  description: string;

  @IsArray()
  @ArrayMaxSize(PRODUCT_LIMITS.mediaMax)
  @ValidateNested({ each: true })
  @Type(() => ProductMediaItemDto)
  media: ProductMediaItemDto[];
}
