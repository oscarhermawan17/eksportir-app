import { LOCALES } from '@balitrade/shared';
import type { Locale } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * What a person may change about their own account: the UI language, and the phone number BaliTrade
 * uses to reach them. Both are optional, so the language switcher can send only `locale` without
 * clearing a number, and the account form only `phone`.
 *
 * The number is never shown to buyers (it is not part of `PublicSellerProfile`) and never leaves the
 * team. Note for whoever adds one-time codes or password resets (T21): once a code can be sent to this
 * number, changing it must require the current password and a check of the new number — otherwise
 * "change the phone, receive the code, take the account" becomes the easiest way in.
 */
export class UpdateMeDto {
  @IsOptional()
  @IsIn(LOCALES)
  locale?: Locale;

  /** An empty string clears the number; `@Matches` is skipped for it by `IsOptional`-style emptiness. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  @Matches(/^$|^\+?[0-9][0-9 ()-]{5,19}$/, { message: 'phone must be a valid phone number' })
  phone?: string;
}
