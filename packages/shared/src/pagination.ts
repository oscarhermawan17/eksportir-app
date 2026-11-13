/**
 * One shape for every paginated admin list (T27), so the three of them cannot drift apart the way the
 * admin pages did twice before.
 *
 * Offset paging with a total, not a cursor: the owner asked for a "last page" button, and no cursor
 * scheme can jump to the end because it never knows how many rows there are. The cost is a second
 * `COUNT(*)` per request, which is the right trade for admin lists of this size.
 */
export interface PageResult<T> {
  items: T[];
  /** Rows matching the filters, not rows on this page — this is what "last page" is computed from. */
  total: number;
  /** 1-based, so it reads the same in the URL as on the buttons. */
  page: number;
  size: PageSize;
}

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** Small enough to load fast; an admin who wants more says so and the URL remembers it. */
export const DEFAULT_PAGE_SIZE: PageSize = 25;

export const PAGINATION_LIMITS = {
  /** Guards against `?q=` being used to send a megabyte of regex-ish text at the database. */
  searchMax: 100,
  /** 1-based page numbers; the ceiling only stops an absurd `?page=` from reaching `skip`. */
  pageMax: 100_000,
} as const;

export function isPageSize(value: unknown): value is PageSize {
  return (PAGE_SIZES as readonly unknown[]).includes(value);
}

/** Total pages for a result, at least 1 so an empty list still reads as "page 1 of 1". */
export function pageCount(total: number, size: PageSize): number {
  return Math.max(1, Math.ceil(total / size));
}
