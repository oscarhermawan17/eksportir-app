'use client';

import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useId } from 'react';

/**
 * Searching is the main way around the shop, so the field lives in the navbar instead of a menu.
 * A plain GET form: it also works without JavaScript and lands on the catalog with ?q=.
 */
export function NavSearch({ className = '' }: { className?: string }) {
  const t = useTranslations('Navbar');
  const locale = useLocale();
  const params = useSearchParams();
  const id = useId();
  const q = params.get('q') ?? '';

  return (
    <form action={`/${locale}/products`} method="get" role="search" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t('searchLabel')}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      {/* Remounted when the active search changes, so the field shows what the catalog is filtered by. */}
      <input
        key={q}
        id={id}
        name="q"
        type="search"
        defaultValue={q}
        maxLength={100}
        placeholder={t('searchPlaceholder')}
        className="h-11 w-full rounded-button border border-border bg-background pl-9 pr-3 text-sm font-medium text-text transition placeholder:text-muted/70 focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
    </form>
  );
}
