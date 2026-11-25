'use client';

import { DATE_PRESETS, isoDate, matchPreset, presetRange, type DatePreset } from '@balitrade/shared';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { DayPicker, type DateRange as PickedRange } from 'react-day-picker';
import { enUS, id as idLocale, ru } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { Button } from '@/components/ui/button';

const LOCALES = { en: enUS, id: idLocale, ru } as const;

/** `YYYY-MM-DD` → a local Date at midnight (never via `new Date(iso)`, which reads it as UTC). */
const fromIso = (iso: string): Date | undefined => {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};

/**
 * How a stored range reads: a preset's name when it still matches one today ("Last 7 days"), otherwise the dates.
 * Shared by the picker's button and the active-filter chip, so the two always say the same thing.
 */
export function useRangeLabel(): (from: string, to: string) => string {
  const t = useTranslations('Table');
  const format = useFormatter();
  return (from, to) => {
    const preset = from && to ? matchPreset({ from, to }, new Date()) : null;
    if (preset) return t(`datePresets.${preset}`);
    const a = fromIso(from);
    const b = fromIso(to);
    if (a && b) return format.dateTimeRange(a, b, { dateStyle: 'medium' });
    if (a) return t('dateFrom', { date: format.dateTime(a, { dateStyle: 'medium' }) });
    if (b) return t('dateUntil', { date: format.dateTime(b, { dateStyle: 'medium' }) });
    return t('dateAll');
  };
}

/**
 * The admin date filter (design system v2, owner's choice 2026-11-26): one button that says what is filtered,
 * opening a panel with quick presets beside a range calendar in the app's own style — the browser's native date
 * input looked foreign ("dd --- yyyy", a Windows popup). Nothing changes until Apply, so a half-picked range
 * never reloads the table. On a phone the panel is a sheet at the bottom of the screen.
 *
 * `which` adds the choice of date column some lists need (a listing has a creation and a review date).
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  which,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string; which?: string }) => void;
  which?: { value: string; options: { value: string; label: string }[] };
}) {
  const t = useTranslations('Table');
  const rangeText = useRangeLabel();
  const locale = useLocale() as keyof typeof LOCALES;
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PickedRange | undefined>(undefined);
  const [draftWhich, setDraftWhich] = useState(which?.value ?? '');
  const [twoMonths, setTwoMonths] = useState(false);

  const today = new Date();
  const active = from || to;
  const preset = from && to ? matchPreset({ from, to }, today) : null;
  const label = active ? rangeText(from, to) : t('dateAll');

  function openPanel() {
    setDraft(from || to ? { from: fromIso(from || to), to: fromIso(to || from) } : undefined);
    setDraftWhich(which?.value ?? '');
    setTwoMonths(window.matchMedia('(min-width: 1024px)').matches);
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  // Escape and a click outside close the panel without applying anything.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  function apply(range: { from: string; to: string }) {
    onChange({ ...range, ...(which ? { which: draftWhich } : {}) });
    close();
  }

  const pickPreset = (key: DatePreset) => apply(presetRange(key, today));
  const draftFrom = draft?.from ? isoDate(draft.from) : '';
  const draftTo = draft?.to ? isoDate(draft.to) : draftFrom;

  return (
    <div ref={rootRef} className="relative sm:ml-auto">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : openPanel())}
        className={`inline-flex h-10 max-w-full items-center gap-2 rounded-button border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          active ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border-strong bg-card text-text hover:border-primary/40'
        }`}
      >
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {which && active ? `${which.options.find((o) => o.value === which.value)?.label ?? ''}: ` : ''}
          {label}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      </button>

      {open ? (
        <>
          {/* A dimmed page behind the sheet on phones only. */}
          <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" aria-hidden="true" />
          <div
            id={panelId}
            role="dialog"
            aria-label={t('datePanelLabel')}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-card border border-border bg-card shadow-lg shadow-black/10 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-max sm:max-w-[calc(100vw-2rem)] sm:rounded-card"
          >
            {which ? (
              <div className="flex gap-1 border-b border-border p-2" role="group" aria-label={t('dateFieldLabel')}>
                {which.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={draftWhich === option.value}
                    onClick={() => setDraftWhich(option.value)}
                    className={`h-8 flex-1 rounded-button px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                      draftWhich === option.value ? 'bg-surface text-primary' : 'text-muted hover:text-text'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row">
              <ul className="flex gap-1 overflow-x-auto border-b border-border p-2 no-scrollbar sm:w-44 sm:flex-col sm:border-b-0 sm:border-r">
                {DATE_PRESETS.map((key) => (
                  <li key={key} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => pickPreset(key)}
                      className={`w-full whitespace-nowrap rounded-button px-3 py-2 text-left text-sm transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary ${
                        preset === key ? 'font-medium text-primary' : 'text-text'
                      }`}
                    >
                      {t(`datePresets.${key}`)}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="p-3">
                <DayPicker
                  mode="range"
                  selected={draft}
                  onSelect={setDraft}
                  locale={LOCALES[locale] ?? enUS}
                  numberOfMonths={twoMonths ? 2 : 1}
                  defaultMonth={draft?.from ?? (twoMonths ? new Date(today.getFullYear(), today.getMonth() - 1, 1) : today)}
                  disabled={{ after: today }}
                  showOutsideDays
                  className="bt-calendar"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-3">
              <p className="mr-auto text-sm text-muted" aria-live="polite">
                {draftFrom ? rangeText(draftFrom, draftTo) : t('datePickHint')}
              </p>
              {active ? (
                <Button variant="ghost" className="h-9 px-3" onClick={() => apply({ from: '', to: '' })}>
                  {t('clearDates')}
                </Button>
              ) : null}
              <Button variant="secondary" className="h-9 px-3" onClick={() => close()}>
                {t('cancel')}
              </Button>
              <Button className="h-9 px-4" disabled={!draftFrom} onClick={() => apply({ from: draftFrom, to: draftTo })}>
                {t('apply')}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
