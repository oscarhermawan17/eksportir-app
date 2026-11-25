'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

/**
 * One box, not one per field (T27). The owner listed "order id, buyer id/name, seller id/name" — five
 * inputs would make an admin decide which one to fill before they can look anything up. The API matches
 * whichever of those the text looks like, which is what people expect of a search box.
 *
 * It searches on Enter rather than as you type: each search writes to the URL, and a request plus a
 * history entry per keystroke is wrong on both counts. The × inside the field clears it (design system v2:
 * no separate Search button).
 */
export function SearchBox({
  value,
  onSearch,
  placeholder,
}: {
  value: string;
  onSearch: (next: string) => void;
  placeholder: string;
}) {
  const t = useTranslations('Table');
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  // The URL is the source of truth: Back, or a filter cleared elsewhere, has to reach the box too.
  // Adjusted during render rather than in an effect — React's own pattern for "reset state when a prop
  // changes", and it avoids the extra render an effect would cost.
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  return (
    <form
      role="search"
      className="relative min-w-0 basis-full sm:max-w-md sm:flex-1 sm:basis-auto"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSearch(text.trim());
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={t('searchLabel')}
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        className="h-10 w-full rounded-button border border-border-strong bg-card pl-9 pr-9 text-sm text-text transition-colors placeholder:text-muted hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {text ? (
        <button
          type="button"
          aria-label={t('clearSearch')}
          title={t('clearSearch')}
          onClick={() => {
            setText('');
            if (value) onSearch('');
          }}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-button text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * What the table is filtered by, as chips that each remove their own filter, plus one Reset. Renders nothing
 * when no filter is on. The status tab is not repeated here: the tab already shows it.
 */
export function ActiveFilters({ filters, onReset }: { filters: ActiveFilter[]; onReset: () => void }) {
  const t = useTranslations('Table');
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">{t('activeFilters')}</span>
      {filters.map((filter) => (
        <span
          key={filter.key}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface py-0.5 pl-2.5 pr-1 text-text"
        >
          <span className="truncate">{filter.label}</span>
          <button
            type="button"
            onClick={filter.onRemove}
            aria-label={t('removeFilter', { filter: filter.label })}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-border hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="rounded-sm px-1 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {t('reset')}
      </button>
    </div>
  );
}
