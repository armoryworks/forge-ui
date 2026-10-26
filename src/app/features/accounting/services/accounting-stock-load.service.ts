import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { formValidationContext } from '../../../shared/interceptors/http-error.interceptor';
import { InventoryValuationReconciliation } from '../models/inventory-valuation.model';
import { StockLoad, StockLoadInput, StockLoadSummary } from '../models/stock-load.model';
import { StockLoadContext, StockLoadValidationResult } from '../models/stock-load-validation.model';

/**
 * §7A opening inventory (`/api/v1/accounting/conversion/stock-loads`): a costed stock load that posts bins, the
 * valuation store and Dr inventory / Cr Opening Balance Equity. Open under CAP-ACCT-MIGRATION or CAP-ACCT-FULLGL.
 * Writes send {@link formValidationContext} so per-row errors come back to the screen instead of a snackbar.
 */
@Injectable({ providedIn: 'root' })
export class AccountingStockLoadService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/accounting/conversion/stock-loads`;

  /** The book, the opening journal's date and the inventory debits it already carries. */
  getContext(bookId?: number | null): Observable<StockLoadContext> {
    const params = bookId ? new HttpParams().set('bookId', bookId) : undefined;
    return this.http.get<StockLoadContext>(`${this.base}/context`, params ? { params } : {});
  }

  /** The book's loads, newest first. */
  list(bookId: number): Observable<StockLoadSummary[]> {
    return this.http.get<StockLoadSummary[]>(this.base, { params: new HttpParams().set('bookId', bookId) });
  }

  get(id: number): Observable<StockLoad> {
    return this.http.get<StockLoad>(`${this.base}/${id}`);
  }

  create(input: StockLoadInput): Observable<StockLoad> {
    return this.http.post<StockLoad>(this.base, input, { context: formValidationContext() });
  }

  update(id: number, input: StockLoadInput): Observable<StockLoad> {
    return this.http.put<StockLoad>(`${this.base}/${id}`, { ...input, id }, { context: formValidationContext() });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** The dry run: per-line errors and warnings and totals per inventory account. */
  validate(id: number): Observable<StockLoadValidationResult> {
    return this.http.post<StockLoadValidationResult>(`${this.base}/${id}/validate`, {});
  }

  post(id: number): Observable<StockLoad> {
    return this.http.post<StockLoad>(`${this.base}/${id}/post`, {}, { context: formValidationContext() });
  }

  void(id: number): Observable<StockLoad> {
    return this.http.post<StockLoad>(`${this.base}/${id}/void`, {}, { context: formValidationContext() });
  }

  /** Inventory GL vs valuation-store tie-out, readable at cutover. */
  getReconciliation(bookId: number): Observable<InventoryValuationReconciliation> {
    return this.http.get<InventoryValuationReconciliation>(`${this.base}/reconciliation`, {
      params: new HttpParams().set('bookId', bookId),
    });
  }
}
