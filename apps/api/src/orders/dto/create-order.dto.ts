import { DELIVERY_COUNTRIES, ORDER_LIMITS } from '@balitrade/shared';
import type { DeliveryCountry } from '@balitrade/shared';
import { Transform, Type } from 'class-transformer';
import { IsDefined, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class DeliveryDto {
  @Transform(trim)
  @IsString()
  @MinLength(ORDER_LIMITS.nameMin)
  @MaxLength(ORDER_LIMITS.nameMax)
  fullName: string;

  @Transform(trim)
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsIn(DELIVERY_COUNTRIES)
  country: DeliveryCountry;

  @Transform(trim)
  @IsString()
  @MinLength(ORDER_LIMITS.addressMin)
  @MaxLength(ORDER_LIMITS.addressMax)
  address: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  productId: string;

  @IsInt()
  @Min(1)
  @Max(ORDER_LIMITS.qtyMax)
  qty: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(ORDER_LIMITS.noteMax)
  note?: string;

  // `ValidateNested` alone skips a missing value, so without IsDefined a request without an address reached the database (500).
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery: DeliveryDto;
}
