'use client';

import type { ContentItemView, ContentKind } from '@balitrade/shared';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

/** The active items of one kind in the page's language; `null` while loading, `'error'` when it failed. */
function useContent(kind: ContentKind): ContentItemView[] | null | 'error' {
  const locale = useLocale();
  const [state, setState] = useState<{ key: string; items: ContentItemView[] | 'error' } | null>(null);
  const key = `${kind}:${locale}`;

  useEffect(() => {
    let cancelled = false;
    apiFetch<ContentItemView[]>(`/content?kind=${kind}&locale=${locale}`)
      .then((items) => !cancelled && setState({ key, items }))
      .catch((error: unknown) => {
        console.error('Could not load page content', error);
        if (!cancelled) setState({ key, items: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [kind, locale, key]);

  return state?.key === key ? state.items : null;
}

function Status({ state }: { state: null | 'error' }) {
  const t = useTranslations('HowItWorks');
  return state === 'error' ? (
    <p className="text-sm text-muted">{t('contentError')}</p>
  ) : (
    <p className="h-40 text-sm text-muted" aria-busy="true">
      {t('contentLoading')}
    </p>
  );
}

/**
 * The steps, written by the OWNER on /admin/content. A vertical numbered list (owner's request, 2026-11-26: "tetap rapi"
 * whether there are 5 steps or 7): one column never leaves a half-empty last row, and it reads the same on a phone.
 * The number is the position, so reordering in the admin renumbers the page. Text only, line breaks kept.
 */
export function HowItWorksSteps() {
  const items = useContent('HOW_IT_WORKS_STEP');
  if (items === null || items === 'error') return <Status state={items} />;

  return (
    <ol className="max-w-[70ch]">
      {items.map((step, index) => (
        <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
          {/* The thin line joining one number to the next; the last step has none below it. */}
          {index < items.length - 1 ? (
            <span className="absolute left-4 top-9 bottom-1 w-px -translate-x-1/2 bg-border" aria-hidden="true" />
          ) : null}
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold tabular-nums text-white">
            {index + 1}
          </span>
          <div className="min-w-0 pt-1">
            <h3 className="text-base font-semibold text-text">{step.title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The questions, written by the OWNER on /admin/content, as an accordion separated by thin lines. */
export function FaqList() {
  const items = useContent('FAQ');
  if (items === null || items === 'error') return <Status state={items} />;

  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <details key={item.id} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
            {item.title}
            <ChevronDown
              className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <p className="max-w-[70ch] whitespace-pre-line pb-4 text-sm leading-relaxed text-muted">{item.body}</p>
        </details>
      ))}
    </div>
  );
}
