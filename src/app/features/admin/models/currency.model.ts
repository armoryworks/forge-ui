/** Multi-currency catalog + per-day FX rates. CAP-MD-CURRENCIES gated. */
export interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isBaseCurrency: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateCurrencyRequest {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isBaseCurrency: boolean;
  sortOrder: number;
}

export interface UpdateCurrencyRequest {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isBaseCurrency: boolean;
  isActive: boolean;
  sortOrder: number;
}

export type ExchangeRateSource = 'Manual' | 'Api' | 'Bank';

export interface ExchangeRate {
  id: number;
  fromCurrencyId: number;
  fromCurrencyCode: string;
  toCurrencyId: number;
  toCurrencyCode: string;
  rate: number;
  effectiveDate: string; // YYYY-MM-DD
  source: ExchangeRateSource;
  fetchedAt: string | null;
}

export interface SetExchangeRateRequest {
  fromCurrencyId: number;
  toCurrencyId: number;
  rate: number;
  effectiveDate: string; // YYYY-MM-DD
}
