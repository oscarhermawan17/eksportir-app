import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class ApplySellerDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  about?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  qcZoneId?: string;
}

/** Same fields as the application; every field is optional when editing. */
export class UpdateSellerDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  about?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  qcZoneId?: string;
}

export class RejectSellerDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
