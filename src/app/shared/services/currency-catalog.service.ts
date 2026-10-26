import { computed, inject, Injectable, signal } from '@angular/core';

import { ActiveCurrency } from '../models/active-currency.model';
import { ActiveCurrencyService } from './active-currency.service';
import { CapabilityService } from './capability.service';

/**
 * The install's active currencies, loaded once and shared, plus whether the install
 * works in more than one currency (more than one active currency and CAP-MD-CURRENCIES
 * on). Lists use {@link isMultiCurrency} to add their functional "Total (base)" column.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyCatalogService {
  private readonly activeCurrencies = inject(ActiveCurrencyService);
  private readonly capabilities = inject(CapabilityService);
  private readonly _currencies = signal<ActiveCurrency[]>([]);
  private requested = false;

  readonly currencies = this._currencies.asReadonly();
  readonly isMultiCurrency = computed(
    () => this._currencies().length > 1 && this.capabilities.isEnabled('CAP-MD-CURRENCIES', true),
  );

  /** Loads the catalog on first use; later calls reuse it. Returns the service for field initializers. */
  ensureLoaded(): this {
    if (!this.requested) {
      this.requested = true;
      this.activeCurrencies.listActiveCurrencies().subscribe(list => this._currencies.set(list));
    }
    return this;
  }
}
