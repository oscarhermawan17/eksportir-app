import { DEFAULT_PAGE_SIZE, OrderStatus, PAGE_SIZES, PAGINATION_LIMITS, PAYOUT_FILTERS } from '@balitrade/shared';
import type { PageSize, PayoutFilter } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
/** "A,B" or ["A","B"] (a repeated parameter) both become a list; an empty item is dropped. */
const toList = ({ value }: { value: unknown }): unknown =>
  value === undefined
    ? undefined
    : (Array.isArray(value) ? value : [value]).flatMap((item) => String(item).split(',')).map((item) => item.trim()).filter(Boolean);

const toInt = ({ value }: { value: unknown }): unknown => (value === undefined ? undefined : Number(value));

/** Query of the admin orders table (T27). The service applies the defaults: page 1 of 25, newest first. */
export class AdminOrderQueryDto {
  /** One status, or several separated by commas: a tab of ORDER_STATUS_GROUPS. Each must be a real status. */
  @IsOptional()
  @Transform(toList)
  @ArrayMaxSize(Object.values(OrderStatus).length)
  @IsIn(Object.values(OrderStatus), { each: true })
  status?: OrderStatus[];

  /** An order code ("OR-1043") or part of a buyer's or seller's name. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(PAGINATION_LIMITS.searchMax)
  q?: string;

  /** Inclusive, on the day the order was requested. */
  /** The payout queue (T20): completed orders not paid out yet, or already paid out. Implies status COMPLETED. */
  @IsOptional()
  @IsIn(PAYOUT_FILTERS)
  payout?: PayoutFilter;

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
