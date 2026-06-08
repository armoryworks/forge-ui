/**
 * A currency the install has configured and marked active. Returned by
 * `GET /api/v1/system/currencies` — a read-only, any-authenticated-user
 * endpoint (distinct from the Admin-only currencies catalog) so operational
 * document/payment forms can offer a currency selector + FX-rate input.
 */
export interface ActiveCurrency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  isBaseCurrency: boolean;
}
