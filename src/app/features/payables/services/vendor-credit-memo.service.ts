import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { VendorCreditMemoListItem } from '../models/vendor-credit-memo-list-item.model';
import { VendorCreditMemoDetail } from '../models/vendor-credit-memo-detail.model';
import { CreateVendorCreditMemoRequest } from '../models/create-vendor-credit-memo-request.model';
import { UpdateVendorCreditMemoRequest } from '../models/update-vendor-credit-memo-request.model';
import { VendorCreditMemoListFilter } from '../models/vendor-credit-memo-list-filter.model';
import { VendorStatement } from '../models/vendor-statement.model';

@Injectable({ providedIn: 'root' })
export class VendorCreditMemoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendor-credit-memos`;

  getMemos(filter: VendorCreditMemoListFilter = {}): Observable<VendorCreditMemoListItem[]> {
    let params = new HttpParams();
    if (filter.vendorId) params = params.set('vendorId', String(filter.vendorId));
    if (filter.status) params = params.set('status', filter.status);
    if (filter.vendorBillId) params = params.set('vendorBillId', String(filter.vendorBillId));
    if (filter.currencyId) params = params.set('currencyId', String(filter.currencyId));
    if (filter.openOnly) params = params.set('openOnly', 'true');
    if (filter.q) params = params.set('q', filter.q);
    return this.http.get<VendorCreditMemoListItem[]>(this.base, { params });
  }

  getById(id: number): Observable<VendorCreditMemoDetail> {
    return this.http.get<VendorCreditMemoDetail>(`${this.base}/${id}`);
  }

  create(request: CreateVendorCreditMemoRequest): Observable<VendorCreditMemoDetail> {
    return this.http.post<VendorCreditMemoDetail>(this.base, request);
  }

  update(id: number, request: UpdateVendorCreditMemoRequest, rowVersion?: number): Observable<VendorCreditMemoDetail> {
    return this.http.put<VendorCreditMemoDetail>(`${this.base}/${id}`, request, { headers: this.ifMatch(rowVersion) });
  }

  delete(id: number, rowVersion?: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, { headers: this.ifMatch(rowVersion) });
  }

  /** Posts the memo (when the built-in ledger is on) and applies it to its bill's balance. */
  issue(id: number): Observable<VendorCreditMemoDetail> {
    return this.http.post<VendorCreditMemoDetail>(`${this.base}/${id}/issue`, {});
  }

  apply(id: number, vendorBillId: number, amount: number): Observable<VendorCreditMemoDetail> {
    return this.http.post<VendorCreditMemoDetail>(`${this.base}/${id}/applications`, { vendorBillId, amount });
  }

  unapply(id: number, applicationId: number): Observable<VendorCreditMemoDetail> {
    return this.http.delete<VendorCreditMemoDetail>(`${this.base}/${id}/applications/${applicationId}`);
  }

  void(id: number, reason: string): Observable<VendorCreditMemoDetail> {
    return this.http.post<VendorCreditMemoDetail>(`${this.base}/${id}/void`, { reason });
  }

  getPdf(id: number, lang: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { params: new HttpParams().set('lang', lang), responseType: 'blob' });
  }

  /** The vendor's open bills and open credits, the credits negative. */
  getStatement(vendorId: number): Observable<VendorStatement> {
    return this.http.get<VendorStatement>(`${this.base}/statement/${vendorId}`);
  }

  private ifMatch(rowVersion?: number): HttpHeaders | undefined {
    return rowVersion != null ? new HttpHeaders({ 'If-Match': `"${rowVersion}"` }) : undefined;
  }
}
