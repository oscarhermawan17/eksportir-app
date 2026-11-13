'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

const INPUT =
  'h-9 rounded-button border border-border bg-card px-3 text-sm font-medium text-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';

/**
 * One box, not one per field (T27). The owner listed "order id, buyer id/name, seller id/name" — five
 * inputs would make an admin decide which one to fill before they can look anything up. The API matches
 * whichever of those the text looks like, which is what people expect of a search box.
 *
 * It submits rather than searching as you type: each search writes to the URL, and a request plus a
 * history entry per keystroke is wrong on both counts.
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
      className="flex items-center gap-2"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSearch(text.trim());
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          aria-label={t('searchLabel')}
          className={`${INPUT} w-56 pl-8`}
        />
      </div>
      <button
        type="submit"
        className="h-9 rounded-button border border-border bg-card px-3 text-sm font-semibold text-primary transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        {t('search')}
      </button>
      {value ? (
        <button
          type="button"
          aria-label={t('clearSearch')}
          onClick={() => {
            setText('');
            onSearch('');
          }}
          className="flex h-9 w-9 items-center justify-center rounded-button text-muted transition hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}

/**
 * An inclusive day range. `which` lets a list offer a choice of date, because "date" alone is ambiguous:
 * a listing has a creation date and a review date, and filtering on the review date hides everything
 * still waiting for review — exactly the rows an admin looks for most.
 */
export function DateRange({
  from,
  to,
  onChange,
  which,
}: {
  from: string;
  to: string;
  onChange: (next: { from?: string; to?: string }) => void;
  which?: { value: string; options: { value: string; label: string }[]; onChange: (next: string) => void };
}) {
  const t = useTranslations('Table');
  return (
    <div className="flex flex-wrap items-center gap-2">
      {which ? (
        <select
          value={which.value}
          onChange={(event) => which.onChange(event.target.value)}
          aria-label={t('dateFieldLabel')}
          className={INPUT}
        >
          {which.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-sm text-muted">{t('dateFieldLabel')}</span>
      )}
      {/* The two dates and their dash wrap as one group: left to the outer flex, a narrow screen
          stranded the dash at the end of a line with its second input on the next one. */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => onChange({ from: event.target.value })}
          aria-label={t('from')}
          className={`${INPUT} min-w-0 flex-1`}
        />
        <span className="shrink-0 text-sm text-muted">–</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => onChange({ to: event.target.value })}
          aria-label={t('to')}
          className={`${INPUT} min-w-0 flex-1`}
        />
      </div>
      {from || to ? (
        <button
          type="button"
          onClick={() => onChange({ from: '', to: '' })}
          className="h-9 rounded-button px-2 text-sm font-semibold text-primary transition hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t('clearDates')}
        </button>
      ) : null}
    </div>
  );
}
