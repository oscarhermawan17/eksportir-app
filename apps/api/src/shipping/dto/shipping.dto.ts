import { SHIPPING_LIMITS, TRACKING_LIMITS, TRACKING_MILESTONES } from '@balitrade/shared';
import type { TrackingMilestone } from '@balitrade/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class ShippingBillLineDto {
  @Transform(trim)
  @IsString()
  @MinLength(SHIPPING_LIMITS.labelMin)
  @MaxLength(SHIPPING_LIMITS.labelMax)
  label: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(SHIPPING_LIMITS.lineMinUsd)
  @Max(SHIPPING_LIMITS.lineMaxUsd)
  amountUsd: number;
}

/** The total is not part of this body: the API adds up the lines itself. */
export class IssueShippingBillDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SHIPPING_LIMITS.linesMax)
  @ValidateNested({ each: true })
  @Type(() => ShippingBillLineDto)
  lines: ShippingBillLineDto[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(SHIPPING_LIMITS.weightMinKg)
  @Max(SHIPPING_LIMITS.weightMaxKg)
  weightKg: number;

  @IsInt()
  @Min(SHIPPING_LIMITS.cartonsMin)
  @Max(SHIPPING_LIMITS.cartonsMax)
  cartons: number;

  /** A private key this admin uploaded; checked in the service. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  photoKey?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(SHIPPING_LIMITS.noteMax)
  note?: string;
}

export class AddTrackingEventDto {
  @IsIn(TRACKING_MILESTONES)
  milestone: TrackingMilestone;

  /** Defaults to now; range checked in the service. */
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(TRACKING_LIMITS.noteMax)
  note?: string;

  /** Required for HANDED_TO_CARGO only (checked in the service). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value))
  @IsString()
  @Matches(TRACKING_LIMITS.awbPattern, { message: 'awb must be an air waybill number like 618-12345675' })
  awb?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  photoKey?: string;
}
