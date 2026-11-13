'use client';

import { DEFAULT_PAGE_SIZE, isPageSize, type PageSize } from '@balitrade/shared';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * The state of an admin table lives in the URL (T27), not in component state.
 *
 * That buys four things for one small helper: the view survives a refresh and the Back button, it can
 * be bookmarked, it can be pasted to a colleague ("look at this payment"), and the page size an admin
 * picked is still there tomorrow. The storefront catalog already works this way, so the two halves of
 * the app behave alike.
 */
export interface TableQuery {
  page: number;
  size: PageSize;
  /** Everything else is list-specific: status, q, from, to, dateField … */
  get: (key: string) => string;
  /** Replaces the given keys; anything set to '' is removed. Resets to page 1 unless page is given. */
  set: (changes: Record<string, string | number | undefined>) => void;
}

export function useTableQuery(): TableQuery {
  const params = useSearchParams();
  const router = useRouter();
  // next-intl's router needs a pathname: handed a bare "?q=…" it does nothing at all, silently, which
  // is how the first version of this looked like a broken search box.
  const pathname = usePathname();

  const rawSize = Number(params.get('size'));
  const size: PageSize = isPageSize(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(params.get('page')) || 1);

  return {
    page,
    size,
    get: (key) => params.get(key)?.trim() ?? '',
    set: (changes) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        const text = value === undefined ? '' : String(value);
        if (text === '') next.delete(key);
        else next.set(key, text);
      }
      // Any change but paging itself puts you back on page 1: staying on page 7 of a filter that now
      // has two pages shows an empty table and looks like a bug.
      if (!('page' in changes)) next.delete('page');
      router.replace(
        { pathname, query: Object.fromEntries(next.entries()) } as Parameters<typeof router.replace>[0],
        { scroll: false },
      );
    },
  };
}

/** Builds the API query string from the table state plus a list's own filters. */
export function toApiQuery(table: TableQuery, keys: string[]): string {
  const query = new URLSearchParams({ page: String(table.page), size: String(table.size) });
  for (const key of keys) {
    const value = table.get(key);
    if (value) query.set(key, value);
  }
  return query.toString();
}
