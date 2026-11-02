import { ORDER_LIMITS } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** Optional explanation that goes with declining or cancelling; it is shown in the order chat. */
export class OrderReasonDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(ORDER_LIMITS.reasonMax)
  reason?: string;
}

export class ProposeChangeDto extends OrderReasonDto {
  /** The quantity the seller can supply; it must be lower than the requested one (checked against the order). */
  @IsInt()
  @Min(1)
  @Max(ORDER_LIMITS.qtyMax)
  qty: number;
}
