import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SelectOption } from '../components/select/select.component';
import { SalesTaxCode } from '../models/sales-tax-code.model';

/**
 * The sales tax codes, loaded once and shared by the tax-code pickers on customers. A failed load (tax codes
 * turned off, or no access) leaves the list empty rather than surfacing an error.
 */
@Injectable({ providedIn: 'root' })
export class SalesTaxCodesService {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly _codes = signal<SalesTaxCode[]>([]);
  private requested = false;

  readonly codes = this._codes.asReadonly();

  /** Active codes as picker options, led by an "address default" choice. */
  readonly options = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('customers.taxCode.addressDefault') },
    ...this._codes().filter(c => c.isActive).map(c => ({
      value: c.id,
      label: `${c.name} (${c.code}) — ${+(c.rate * 100).toFixed(4)}%`,
    })),
  ]);

  /** Loads the list on first use; later calls reuse it. Returns the service for field initializers. */
  ensureLoaded(): this {
    if (!this.requested) {
      this.requested = true;
      this.http.get<SalesTaxCode[]>(`${environment.apiUrl}/sales-tax-rates`)
        .pipe(catchError(() => of([] as SalesTaxCode[])))
        .subscribe(list => this._codes.set(list));
    }
    return this;
  }

  /** The code with this id, for read-only display. */
  find(id: number | null | undefined): SalesTaxCode | undefined {
    return id == null ? undefined : this._codes().find(c => c.id === id);
  }
}
