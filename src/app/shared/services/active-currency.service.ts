import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ActiveCurrency } from '../models/active-currency.model';

/**
 * Loads the install's ACTIVE currency catalog from the any-authenticated-user
 * endpoint `GET /api/v1/system/currencies`. Operational forms (invoice / vendor
 * bill / payment creation) use this to decide whether to show a currency
 * selector at all — single-currency installs return one row, so the selector
 * stays hidden and callers default to the base currency.
 *
 * This is intentionally separate from the Admin-only
 * `features/admin/services/currency.service.ts` (which gates on the Admin role
 * + CAP-MD-CURRENCIES) so non-admin invoice/payment creators are never 403'd.
 *
 * Errors fall back to an empty list — callers treat "couldn't load" the same as
 * "single currency": hide the selector, send no currencyId, let the server pick
 * the functional currency.
 */
@Injectable({ providedIn: 'root' })
export class ActiveCurrencyService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/system/currencies`;

  listActiveCurrencies(): Observable<ActiveCurrency[]> {
    return this.http.get<ActiveCurrency[]>(this.base).pipe(catchError(() => of([])));
  }
}
