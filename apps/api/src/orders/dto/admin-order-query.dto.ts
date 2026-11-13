import { DEFAULT_PAGE_SIZE, OrderStatus, PAGE_SIZES, PAGINATION_LIMITS } from '@balitrade/shared';
import type { PageSize } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const toInt = ({ value }: { value: unknown }): unknown => (value === undefined ? undefined : Number(value));

/** Query of the admin orders table (T27). The service applies the defaults: page 1 of 25, newest first. */
export class AdminOrderQueryDto {
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;

  /** An order code ("OR-1043") or part of a buyer's or seller's name. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(PAGINATION_LIMITS.searchMax)
  q?: string;

  /** Inclusive, on the day the order was requested. */
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
