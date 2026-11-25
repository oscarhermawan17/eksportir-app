'use client';

import { useFormatter } from 'next-intl';

export interface StatusTab {
  key: string;
  label: string;
  /** Rows this tab would list under the current search and dates; left out while unknown. */
  count?: number;
}

/**
 * The status tabs on top of an admin table (design system v2): one row, an underline under the active tab and
 * a count beside each label. They change a URL filter, so they are buttons with `aria-current` rather than an
 * ARIA tablist (there are no tab panels). On a phone the row scrolls sideways instead of wrapping.
 */
export function StatusTabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: StatusTab[];
  active: string;
  onChange: (key: string) => void;
  /** Accessible name of the group, e.g. "Order status". */
  label: string;
}) {
  const format = useFormatter();
  return (
    <nav aria-label={label} className="no-scrollbar overflow-x-auto">
      <ul className="flex w-max min-w-full gap-1 px-2">
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <li key={tab.key}>
              <button
                type="button"
                aria-current={on ? 'true' : undefined}
                onClick={() => onChange(tab.key)}
                className={`relative flex h-12 items-center gap-2 whitespace-nowrap px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                  on ? 'text-primary' : 'text-muted hover:text-text'
                }`}
              >
                {tab.label}
                {tab.count === undefined ? null : (
                  <span
                    className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums ${
                      on ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'
                    }`}
                  >
                    {format.number(tab.count)}
                  </span>
                )}
                {on ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
