import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';
import { ExchangeRateLookup } from '../models/exchange-rate-lookup.model';
import { toDateOnly } from '../utils/date.utils';

/**
 * Asks the server which exchange rate it would book for a document: the
 * latest rate on file on or before the document date (inverse or
 * triangulated when needed). A pair with no rate answers 422
 * `fx-rate-missing`, which callers show inline, so the request is silent.
 */
@Injectable({ providedIn: 'root' })
export class ExchangeRateLookupService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/system/exchange-rate`;

  lookup(fromCurrencyId: number, date: Date | null, toCurrencyId?: number | null): Observable<ExchangeRateLookup> {
    let params = new HttpParams().set('from', fromCurrencyId);
    if (toCurrencyId != null) params = params.set('to', toCurrencyId);
    const day = toDateOnly(date);
    if (day) params = params.set('date', day);
    return this.http.get<ExchangeRateLookup>(this.base, {
      params,
      context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
    });
  }
}
