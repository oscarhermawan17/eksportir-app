import { DEFAULT_PAGE_SIZE, PAGE_SIZES, PAGINATION_LIMITS } from '@balitrade/shared';
import type { PageSize } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const toInt = ({ value }: { value: unknown }): unknown => (value === undefined ? undefined : Number(value));

/**
 * What every paged admin list accepts besides its own status filter (T27): a search text, an inclusive day range
 * (a Bali day, see common/business-day.ts) and the page. A list's DTO extends this and adds its `status`.
 */
export class AdminListQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(PAGINATION_LIMITS.searchMax)
  q?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_LIMITS.pageMax)
  page?: number;

  @IsOptional()
  @Transform(toInt)
  @IsIn(PAGE_SIZES)
  size?: PageSize = DEFAULT_PAGE_SIZE;
}
