import { describe, expect, it } from 'vitest';
import { businessDate, endOfBusinessDay, startOfBusinessDay } from './business-day.js';

describe('business day (Bali time, UTC+8)', () => {
  it('starts and ends the day on Bali time whatever the machine time zone', () => {
    expect(startOfBusinessDay('2026-11-26')?.toISOString()).toBe('2026-11-25T16:00:00.000Z');
    expect(endOfBusinessDay('2026-11-26')?.toISOString()).toBe('2026-11-26T15:59:59.999Z');
  });

  it('ignores a time part and leaves an empty filter empty', () => {
    expect(startOfBusinessDay('2026-11-26T10:00:00Z')?.toISOString()).toBe('2026-11-25T16:00:00.000Z');
    expect(startOfBusinessDay(undefined)).toBeUndefined();
    expect(endOfBusinessDay('')).toBeUndefined();
  });

  it('puts an early-morning Bali moment on its own Bali date, not the UTC one', () => {
    // 03:29 on 26 November in Bali is still 25 November in UTC.
    expect(businessDate(new Date('2026-11-25T19:29:00Z'))).toBe('2026-11-26');
    expect(businessDate(new Date('2026-11-26T15:59:59Z'))).toBe('2026-11-26');
    expect(businessDate(new Date('2026-11-26T16:00:00Z'))).toBe('2026-11-27');
  });
});
