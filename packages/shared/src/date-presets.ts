/** The quick choices in the admin date filter, in the order they are offered. */
export const DATE_PRESETS = ['today', 'last7', 'last30', 'thisMonth', 'lastMonth'] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

/** A calendar date as `YYYY-MM-DD`, from the local date parts (never via UTC, which can shift the day). */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The inclusive `{ from, to }` of a preset, counted from `today` (a local date; the time part is ignored). */
export function presetRange(preset: DatePreset, today: Date): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const day = (offset: number) => isoDate(new Date(y, m, d + offset));
  switch (preset) {
    case 'today':
      return { from: day(0), to: day(0) };
    case 'last7':
      return { from: day(-6), to: day(0) };
    case 'last30':
      return { from: day(-29), to: day(0) };
    case 'thisMonth':
      return { from: isoDate(new Date(y, m, 1)), to: day(0) };
    case 'lastMonth':
      // Day 0 of a month is the last day of the month before it.
      return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) };
  }
}

/** The preset a stored range corresponds to today, if any — so the button can say "Last 7 days" again. */
export function matchPreset(range: { from: string; to: string }, today: Date): DatePreset | null {
  return DATE_PRESETS.find((preset) => {
    const r = presetRange(preset, today);
    return r.from === range.from && r.to === range.to;
  }) ?? null;
}
