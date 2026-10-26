import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, catchError, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SelectOption } from '../components/select/select.component';
import { PaymentTerm } from '../models/payment-term.model';
import { PaymentTermRequest } from '../models/payment-term-request.model';

/**
 * The payment terms master (Net 30, 2/10 Net 30, ...), loaded once and shared by every terms picker on customers,
 * vendors, orders, invoices and bills. Writes go through the finance-role endpoints and refresh the shared list.
 */
@Injectable({ providedIn: 'root' })
export class PaymentTermsService {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly base = `${environment.apiUrl}/payment-terms`;
  private readonly _terms = signal<PaymentTerm[]>([]);
  private requested = false;

  readonly terms = this._terms.asReadonly();

  /** Active terms as picker options, led by a "None" choice. */
  readonly options = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('common.none') },
    ...this._terms().filter(t => t.isActive).map(t => ({ value: t.id, label: t.name })),
  ]);

  /** Loads the list on first use; later calls reuse it. Returns the service for field initializers. */
  ensureLoaded(): this {
    if (!this.requested) {
      this.requested = true;
      this.reload();
    }
    return this;
  }

  reload(): void {
    this.http.get<PaymentTerm[]>(this.base, { params: { includeInactive: true } })
      .pipe(catchError(() => of([] as PaymentTerm[])))
      .subscribe(list => this._terms.set(list));
  }

  find(id: number | null | undefined): PaymentTerm | undefined {
    return id == null ? undefined : this._terms().find(t => t.id === id);
  }

  /** The terms that stand for a legacy credit-terms value (`Net30`), for records that carry only that. */
  forLegacy(creditTerms: string | null | undefined): PaymentTerm | undefined {
    return creditTerms ? this._terms().find(t => t.legacyCreditTerms === creditTerms) : undefined;
  }

  list(includeInactive = true): Observable<PaymentTerm[]> {
    return this.http.get<PaymentTerm[]>(this.base, { params: { includeInactive } });
  }

  create(request: PaymentTermRequest): Observable<PaymentTerm> {
    return this.http.post<PaymentTerm>(this.base, request).pipe(tap(() => this.reload()));
  }

  update(id: number, request: PaymentTermRequest): Observable<PaymentTerm> {
    return this.http.put<PaymentTerm>(`${this.base}/${id}`, request).pipe(tap(() => this.reload()));
  }
}
