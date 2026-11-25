/**
 * Admin date filters name a plain day ("2026-11-26"). Which hours that day covers must not depend on the machine
 * the API runs on — the laptop is on Bali time, the server's container on UTC, and the same filter used to return
 * different orders on each. BaliTrade works on Bali time, so a day is always a WITA day (UTC+8, no daylight saving).
 */
export const BUSINESS_UTC_OFFSET = '+08:00';
const OFFSET_MS = 8 * 60 * 60 * 1000;

/** First millisecond of that Bali day. Only the `YYYY-MM-DD` part of the input is used. */
export function startOfBusinessDay(iso?: string): Date | undefined {
  return iso ? new Date(`${iso.slice(0, 10)}T00:00:00.000${BUSINESS_UTC_OFFSET}`) : undefined;
}

/** Last millisecond of that Bali day, so a one-day range is inclusive. */
export function endOfBusinessDay(iso?: string): Date | undefined {
  return iso ? new Date(`${iso.slice(0, 10)}T23:59:59.999${BUSINESS_UTC_OFFSET}`) : undefined;
}

/** The Bali calendar date of a moment, as `YYYY-MM-DD` — "today" for an admin in Bali. */
export function businessDate(at: Date = new Date()): string {
  return new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}
