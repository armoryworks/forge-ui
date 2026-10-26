import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CreditMemoListItem } from '../models/credit-memo-list-item.model';
import { CreditMemoDetail } from '../models/credit-memo-detail.model';
import { CreateCreditMemoRequest } from '../models/create-credit-memo-request.model';
import { CustomerRefundRequest } from '../models/customer-refund-request.model';
import { CustomerRefund } from '../models/customer-refund.model';

export interface CreditMemoListFilter {
  customerId?: number | null;
  status?: string | null;
  invoiceId?: number | null;
  openOnly?: boolean;
  q?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CreditMemoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/credit-memos`;

  getCreditMemos(filter: CreditMemoListFilter = {}): Observable<CreditMemoListItem[]> {
    let params = new HttpParams();
    if (filter.customerId) params = params.set('customerId', String(filter.customerId));
    if (filter.status) params = params.set('status', filter.status);
    if (filter.invoiceId) params = params.set('invoiceId', String(filter.invoiceId));
    if (filter.openOnly) params = params.set('openOnly', 'true');
    if (filter.q) params = params.set('q', filter.q);
    return this.http.get<CreditMemoListItem[]>(this.base, { params });
  }

  getById(id: number): Observable<CreditMemoDetail> {
    return this.http.get<CreditMemoDetail>(`${this.base}/${id}`);
  }

  create(request: CreateCreditMemoRequest): Observable<CreditMemoDetail> {
    return this.http.post<CreditMemoDetail>(this.base, request);
  }

  delete(id: number, rowVersion?: number): Observable<void> {
    const headers = rowVersion != null ? new HttpHeaders({ 'If-Match': `"${rowVersion}"` }) : undefined;
    return this.http.delete<void>(`${this.base}/${id}`, { headers });
  }

  issue(id: number): Observable<CreditMemoDetail> {
    return this.http.post<CreditMemoDetail>(`${this.base}/${id}/issue`, {});
  }

  apply(id: number, invoiceId: number, amount: number): Observable<CreditMemoDetail> {
    return this.http.post<CreditMemoDetail>(`${this.base}/${id}/applications`, { invoiceId, amount });
  }

  unapply(id: number, applicationId: number): Observable<CreditMemoDetail> {
    return this.http.delete<CreditMemoDetail>(`${this.base}/${id}/applications/${applicationId}`);
  }

  refund(id: number, request: CustomerRefundRequest): Observable<CreditMemoDetail> {
    return this.http.post<CreditMemoDetail>(`${this.base}/${id}/refund`, request);
  }

  void(id: number, reason: string): Observable<CreditMemoDetail> {
    return this.http.post<CreditMemoDetail>(`${this.base}/${id}/void`, { reason });
  }

  voidRefund(refundId: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/refunds/${refundId}/void`, { reason });
  }

  getPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }

  writeOffInvoice(invoiceId: number, amount: number | null, reason: string): Observable<CreditMemoDetail> {
    return this.http.post<CreditMemoDetail>(`${environment.apiUrl}/invoices/${invoiceId}/write-off`, { amount, reason });
  }

  refundPayment(paymentId: number, request: CustomerRefundRequest): Observable<CustomerRefund> {
    return this.http.post<CustomerRefund>(`${environment.apiUrl}/payments/${paymentId}/refund`, request);
  }
}
