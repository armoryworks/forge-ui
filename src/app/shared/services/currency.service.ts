import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

/**
 * Loads the install's base currency once on app init and exposes it as a
 * read-only signal for the rest of the UI. Pricing rows ship with their
 * own currency code; the &lt;app-currency-display&gt; component compares
 * the row's code to {@link baseCurrency} to decide whether to suffix the
 * ISO code inline (e.g. "€1.50 EUR" when the base is USD).
 *
 * No FX conversion happens here — that's a deliberate non-goal until a
 * real exchange-rate layer ships. The mismatch suffix is the disambiguation
 * cue for users today.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly http = inject(HttpClient);
  private readonly _baseCurrency = signal<string>('USD');

  /** Reactive signal — read this in templates / computeds. Defaults to USD. */
  readonly baseCurrency = this._baseCurrency.asReadonly();

  /**
   * Load the install's base currency from the API. Call once on app init
   * (after auth so the request is authorised). Falls back to USD if the
   * request errors (offline, 401 race, etc.) — this is the right default
   * and the next reload will retry.
   */
  load(): Observable<string> {
    return this.http
      .get<{ baseCurrency: string }>(`${environment.apiUrl}/system/currency-base`)
      .pipe(
        map(r => r.baseCurrency),
        tap(c => this._baseCurrency.set(c)),
        catchError(() => of('USD')),
      );
  }
}
