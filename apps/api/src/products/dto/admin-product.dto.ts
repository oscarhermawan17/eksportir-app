import { PRODUCT_LIMITS } from '@balitrade/shared';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class TranslationTextDto {
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
}

/** Only the languages that are sent are changed. */
export class ProductTranslationsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TranslationTextDto)
  en?: TranslationTextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TranslationTextDto)
  id?: TranslationTextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TranslationTextDto)
  ru?: TranslationTextDto;
}

export class RejectProductDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
