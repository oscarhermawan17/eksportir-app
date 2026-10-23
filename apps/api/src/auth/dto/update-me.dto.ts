import { LOCALES } from '@balitrade/shared';
import type { Locale } from '@balitrade/shared';
import { IsIn } from 'class-validator';

export class UpdateMeDto {
  @IsIn(LOCALES)
  locale: Locale;
}
