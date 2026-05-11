import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateCurrencyRequest,
  Currency,
  ExchangeRate,
  SetExchangeRateRequest,
  UpdateCurrencyRequest,
} from '../models/currency.model';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly http = inject(HttpClient);
  private readonly currencyBase = `${environment.apiUrl}/admin/currencies`;
  private readonly rateBase = `${environment.apiUrl}/admin/exchange-rates`;

  listCurrencies(): Observable<Currency[]> {
    return this.http.get<Currency[]>(this.currencyBase);
  }

  createCurrency(request: CreateCurrencyRequest): Observable<Currency> {
    return this.http.post<Currency>(this.currencyBase, request);
  }

  updateCurrency(id: number, request: UpdateCurrencyRequest): Observable<void> {
    return this.http.put<void>(`${this.currencyBase}/${id}`, request);
  }

  listExchangeRates(opts: {
    fromCurrencyId?: number; toCurrencyId?: number;
    dateFrom?: string; dateTo?: string;
  } = {}): Observable<ExchangeRate[]> {
    let params = new HttpParams();
    if (opts.fromCurrencyId) params = params.set('fromCurrencyId', String(opts.fromCurrencyId));
    if (opts.toCurrencyId) params = params.set('toCurrencyId', String(opts.toCurrencyId));
    if (opts.dateFrom) params = params.set('dateFrom', opts.dateFrom);
    if (opts.dateTo) params = params.set('dateTo', opts.dateTo);
    return this.http.get<ExchangeRate[]>(this.rateBase, { params });
  }

  setExchangeRate(request: SetExchangeRateRequest): Observable<ExchangeRate> {
    return this.http.post<ExchangeRate>(this.rateBase, request);
  }
}
