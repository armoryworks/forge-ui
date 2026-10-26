/**
 * The rate the server books for a currency pair on a date, from
 * `GET /api/v1/system/exchange-rate`. `effectiveDate` is the date of the rate
 * row used (null for the same currency); `source` is one of `same-currency`,
 * `direct`, `inverse`, `triangulated`.
 */
export interface ExchangeRateLookup {
  rate: number;
  effectiveDate: string | null;
  source: string;
}
