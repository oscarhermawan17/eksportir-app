/** The part of a menu entry this module needs: everything else belongs to the area that owns the menu. */
export interface NavEntry {
  href: string;
}

/**
 * The deepest entry whose href covers this path — the one to mark as current and to name the page in
 * the top bar. Both areas start their menu with a root entry (`/admin`, `/seller`) that is a prefix of
 * every other entry, so the longest match has to win; taking the first would always pick the root.
 */
export function deepestMatch<T extends NavEntry>(items: readonly T[], pathname: string): T | null {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .reduce<T | null>((best, item) => (best === null || item.href.length > best.href.length ? item : best), null);
}
