import { DEFAULT_LOCALE, LOCALES } from '@balitrade/shared';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
});
