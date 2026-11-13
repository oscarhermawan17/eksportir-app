'use client';

import { PAGE_SIZES, pageCount, type PageSize } from '@balitrade/shared';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Tailwind classes for the cell and its header, e.g. a fixed width or right alignment. */
  className?: string;
}

/**
 * The one table the three admin lists share (T27). Listing, orders and payments have the same
 * mechanics — page, filter, open a row — and the admin pages have already drifted apart twice (the
 * content container and the page headings), so the mechanics live here and each page only supplies
 * its columns, its card and its toolbar.
 *
 * Below `lg` it renders cards rather than a table that scrolls sideways. Scrolling right to read the
 * status pushes the order code off screen, and reading one row across is the entire point of a table —
 * a table you cannot see across is just an awkward list. On a phone an admin is triaging ("which of
 * these needs me?"), not comparing rows, and a card answers that better.
 */
export function DataTable<T>({
  rows,
  failed,
  onRetry,
  columns,
  rowKey,
  card,
  total,
  page,
  size,
  onPage,
  onSize,
  filtered,
  toolbar,
}: {
  /** null while loading. */
  rows: T[] | null;
  failed: boolean;
  onRetry: () => void;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** A card is written separately, not squeezed from the row: it shows fewer, different facts. */
  card: (row: T) => ReactNode;
  total: number;
  page: number;
  size: PageSize;
  onPage: (page: number) => void;
  onSize: (size: PageSize) => void;
  /** True when a filter or search is on, so "nothing found" can be told apart from "nothing here". */
  filtered: boolean;
  toolbar?: ReactNode;
}) {
  const t = useTranslations('Table');
  const tCommon = useTranslations('Common');

  const pages = pageCount(total, size);
  const firstRow = total === 0 ? 0 : (page - 1) * size + 1;
  const lastRow = Math.min(page * size, total);

  return (
    <div>
      {toolbar}

      {failed ? (
        <div className="mt-4 rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          <p role="alert">{t('loadError')}</p>
          <Button variant="secondary" className="mt-2 h-9" onClick={onRetry}>
            {tCommon('retry')}
          </Button>
        </div>
      ) : rows === null ? (
        <div className="mt-4 h-32" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-card border border-border bg-card px-5 py-10 text-center text-muted">
          {filtered ? t('noMatch') : t('empty')}
        </p>
      ) : (
        <>
          {/* Cards below lg, table from lg up. Only one is in the DOM at a time. */}
          <ul className="mt-4 space-y-3 lg:hidden">
            {rows.map((row) => (
              <li key={rowKey(row)} className="rounded-card border border-border bg-card p-4 shadow-sm">
                {card(row)}
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-hidden rounded-card border border-border bg-card shadow-sm lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/60 text-left">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted ${column.className ?? ''}`}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-background/40">
                    {columns.map((column) => (
                      <td key={column.key} className={`px-4 py-3 align-top text-text ${column.className ?? ''}`}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {rows !== null && !failed ? (
        <nav
          aria-label={t('paginationLabel')}
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm"
        >
          <p className="text-muted" aria-live="polite">
            {t('showing', { from: firstRow, to: lastRow, total })}
          </p>

          <label className="flex items-center gap-2 text-muted">
            {t('perPage')}
            <select
              value={size}
              onChange={(event) => onSize(Number(event.target.value) as PageSize)}
              className="h-9 rounded-button border border-border bg-card px-2 text-sm font-medium text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            >
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted">{t('pageOf', { page, pages })}</span>
            <PageButton label={t('first')} icon={ChevronFirst} disabled={page <= 1} onClick={() => onPage(1)} />
            <PageButton label={t('prev')} icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} />
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
      className="flex h-9 w-9 items-center justify-center rounded-button border border-border bg-card text-primary transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
