import { SELF_REGISTER_ROLES, LOCALES } from '@balitrade/shared';
import type { Locale, SelfRegisterRole } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @IsOptional()
  @IsIn(LOCALES)
  locale?: Locale;

  /** Defaults to BUYER. Admin roles can never be self-assigned. */
  @IsOptional()
  @IsIn(SELF_REGISTER_ROLES)
  role?: SelfRegisterRole;
}
