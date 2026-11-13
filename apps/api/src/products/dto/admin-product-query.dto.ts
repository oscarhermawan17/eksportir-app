import {
  ADMIN_PRODUCT_DATE_FIELDS,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  PAGINATION_LIMITS,
} from '@balitrade/shared';
import type { AdminProductDateField, PageSize, ProductStatus } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const toInt = ({ value }: { value: unknown }): unknown => (value === undefined ? undefined : Number(value));

/**
 * Query of the admin listing table (T27). Everything is optional and the service applies the defaults,
 * so an admin arriving with a bare URL gets page 1 of 25, newest first.
 */
export class AdminProductQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'])
  status?: ProductStatus;

  /** Matches the title in any language, or the seller's shop name. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(PAGINATION_LIMITS.searchMax)
  q?: string;

  @IsOptional()
  @IsIn(ADMIN_PRODUCT_DATE_FIELDS)
  dateField?: AdminProductDateField;

  /** Inclusive, as a plain date: `from` starts at 00:00 and `to` ends at 23:59:59.999. */
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

  /** Only the three sizes the UI offers; anything else is a client bug, not a preference. */
  @IsOptional()
  @Transform(toInt)
  @IsIn(PAGE_SIZES)
  size?: PageSize = DEFAULT_PAGE_SIZE;
}
