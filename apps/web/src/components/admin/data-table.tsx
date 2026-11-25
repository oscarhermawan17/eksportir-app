'use client';

import { PAGE_SIZES, pageCount, type PageSize } from '@balitrade/shared';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MouseEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Tailwind classes for the cell and its header, e.g. a fixed width or right alignment. */
  className?: string;
}

/**
 * The one table the admin lists share (T27). Listing, orders and the order queues have the same mechanics —
 * page, filter, open a row — so the mechanics live here and each page only supplies its columns, its card,
 * its tabs and its toolbar.
 *
 * One bordered container holds everything, top to bottom: status tabs, toolbar, active-filter chips, rows,
 * pagination (design system v2, 2026-11-26). With `rowHref` a whole row opens its record: the first cell
 * carries the real link (keyboard, Ctrl+click and middle-click all work on it) and a click anywhere else in
 * the row follows the same href.
 *
 * Below `lg` it renders cards rather than a table that scrolls sideways: on a phone an admin is triaging
 * ("which of these needs me?"), not comparing rows, and a card answers that better.
 */
export function DataTable<T>({
  rows,
  failed,
  onRetry,
  columns,
  rowKey,
  rowHref,
  card,
  total,
  page,
  size,
  onPage,
  onSize,
  filtered,
  tabs,
  toolbar,
  activeFilters,
}: {
  /** null while loading. */
  rows: T[] | null;
  failed: boolean;
  onRetry: () => void;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Where a row leads. Cards must then contain no links of their own: the whole card is the link. */
  rowHref?: (row: T) => string;
  /** A card is written separately, not squeezed from the row: it shows fewer, different facts. */
  card: (row: T) => ReactNode;
  total: number;
  page: number;
  size: PageSize;
  onPage: (page: number) => void;
  onSize: (size: PageSize) => void;
  /** True when a filter or search is on, so "nothing found" can be told apart from "nothing here". */
  filtered: boolean;
  tabs?: ReactNode;
  toolbar?: ReactNode;
  activeFilters?: ReactNode;
}) {
  const t = useTranslations('Table');
  const tCommon = useTranslations('Common');
  const router = useRouter();

  const pages = pageCount(total, size);
  const firstRow = total === 0 ? 0 : (page - 1) * size + 1;
  const lastRow = Math.min(page * size, total);

  /** A click on the row outside its link: same destination, same modifier behaviour as the link itself. */
  const openRow = (event: MouseEvent<HTMLTableRowElement>, href: string) => {
    if ((event.target as HTMLElement).closest('a, button, input, select, label')) return;
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    router.push(href);
  };

  return (
    // No overflow-hidden here: the date picker opens out of the toolbar and must not be clipped by the table.
    <div className="rounded-card border border-border bg-card">
      {tabs ? <div className="border-b border-border">{tabs}</div> : null}
      {toolbar || activeFilters ? (
        <div className="space-y-3 border-b border-border p-4">
          {toolbar}
          {activeFilters}
        </div>
      ) : null}

      {failed ? (
        <div className="px-4 py-6 text-sm text-error">
          <p role="alert">{t('loadError')}</p>
          <Button variant="secondary" className="mt-3 h-9" onClick={onRetry}>
            {tCommon('retry')}
          </Button>
        </div>
      ) : rows === null ? (
        <div className="h-40" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="px-5 py-14 text-center text-muted">{filtered ? t('noMatch') : t('empty')}</p>
      ) : (
        <>
          {/* Cards below lg, table from lg up. */}
          <ul className="divide-y divide-border lg:hidden">
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <li key={rowKey(row)}>
                  {href ? (
                    <Link
                      href={href}
                      className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                    >
                      <div className="min-w-0 flex-1">{card(row)}</div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    </Link>
                  ) : (
                    <div className="px-4 py-4">{card(row)}</div>
                  )}
                </li>
              );
            })}
          </ul>

          <table className="hidden w-full text-sm lg:table">
            <thead>
              <tr className="border-b border-border text-left">
                {columns.map((column) => (
                  <th key={column.key} scope="col" className={`px-4 py-3 font-medium text-muted ${column.className ?? ''}`}>
                    {column.header}
                  </th>
                ))}
                {rowHref ? <th scope="col" className="w-10" aria-hidden="true" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = rowHref?.(row);
                return (
                  <tr
                    key={rowKey(row)}
                    onClick={href ? (event) => openRow(event, href) : undefined}
                    onAuxClick={href ? (event) => openRow(event, href) : undefined}
                    className={`border-b border-border last:border-0 ${href ? 'cursor-pointer transition-colors hover:bg-surface' : ''}`}
                  >
                    {columns.map((column, index) => (
                      <td key={column.key} className={`px-4 py-3 align-middle text-text ${column.className ?? ''}`}>
                        {href && index === 0 ? (
                          <Link
                            href={href}
                            className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {column.cell(row)}
                          </Link>
                        ) : (
                          column.cell(row)
                        )}
                      </td>
                    ))}
                    {href ? (
                      <td className="px-2 py-3 align-middle text-muted" aria-hidden="true">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {rows !== null && !failed ? (
        <nav
          aria-label={t('paginationLabel')}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-sm"
        >
          <p className="tabular-nums text-muted" aria-live="polite">
            {t('showing', { from: firstRow, to: lastRow, total })}
          </p>

          <label className="flex items-center gap-2 text-muted">
            {t('perPage')}
            <select
              value={size}
              onChange={(event) => onSize(Number(event.target.value) as PageSize)}
              className="h-8 rounded-button border border-border-strong bg-card px-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            >
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-1">
            <PageButton label={t('first')} icon={ChevronFirst} disabled={page <= 1} onClick={() => onPage(1)} />
            <PageButton label={t('prev')} icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} />
            <span className="px-2 tabular-nums text-muted">{t('pageOf', { page, pages })}</span>
            <PageButton label={t('next')} icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} />
            <PageButton label={t('last')} icon={ChevronLast} disabled={page >= pages} onClick={() => onPage(pages)} />
          </div>
        </nav>
      ) : null}
    </div>
  );
}

/** Disabled rather than hidden at the ends, so the row of buttons never shifts under the cursor. */
function PageButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof ChevronLeft;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-button text-text transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
