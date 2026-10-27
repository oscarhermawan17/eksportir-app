/**
 * Manual USD/IDR exchange rate (T11). The rate is "IDR per 1 USD" (e.g. 16250.5000), kept as a string
 * because it is an exact decimal (never a float). Prices are listed in IDR and shown to buyers in USD.
 */
export const FX_LIMITS = {
  /** Sanity bounds that catch typos (a missing or extra zero); not a market forecast. */
  min: 1_000,
  max: 100_000,
  /** Matches Decimal(12,4) in the database. */
  maxDecimalPlaces: 4,
} as const;

/** The rate in force now, as returned by the public GET /api/fx/current. `null` until the owner sets one. */
export interface CurrentRateView {
  rate: string | null;
  updatedAt: string | null;
}

/** One row of the rate history (admin). */
export interface ExchangeRateView {
  id: string;
  rate: string;
  setBy: { id: string; name: string };
  createdAt: string;
}

/** Body of POST /api/admin/exchange-rates. */
export interface ExchangeRateInput {
  rate: number;
}
