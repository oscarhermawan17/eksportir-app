import { Prisma } from '../generated/prisma/client.js';

/**
 * Converts a price in whole rupiah to USD at `rate` (IDR per 1 USD), rounded half-up to cents.
 * Decimal arithmetic only: money never goes through floats. Returns a string like "6.80".
 */
export function idrToUsd(priceIdr: number, rate: Prisma.Decimal | string): string {
  const divisor = new Prisma.Decimal(rate);
  if (!divisor.isPositive() || divisor.isZero()) {
    throw new RangeError('Exchange rate must be greater than zero');
  }
  return new Prisma.Decimal(priceIdr).div(divisor).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}
