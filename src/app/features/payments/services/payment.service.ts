import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { PagedResponse, PagedQuery } from '../../../shared/models/paged-response.model';
import { PaymentListItem } from '../models/payment-list-item.model';
import { PaymentDetail } from '../models/payment-detail.model';
import { CreatePaymentRequest } from '../models/create-payment-request.model';

/** Phase 3 F7-broad / WU-22 — paged payment list query parameters. */
export interface PaymentListPagedQuery extends PagedQuery {
  customerId?: number | null;
  paymentMethod?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/payments`;

  /**
   * Phase 3 F7-broad / WU-22 — backward-compat shim that calls the paged
   * endpoint and unwraps the envelope.
   */
  getPayments(customerId?: number): Observable<PaymentListItem[]> {
    return this.getPaymentsPaged({ customerId, pageSize: 200 })
      .pipe(map(p => p.items));
  }

  /**
   * Phase 3 F7-broad / WU-22 — paged payment list. Returns the standard
   * envelope ({ items, totalCount, page, pageSize }).
   */
  getPaymentsPaged(query: PaymentListPagedQuery = {}): Observable<PagedResponse<PaymentListItem>> {
    let params = new HttpParams();
    if (query.page != null) params = params.set('page', String(query.page));
    if (query.pageSize != null) params = params.set('pageSize', String(query.pageSize));
    if (query.sort) params = params.set('sort', query.sort);
    if (query.order) params = params.set('order', query.order);
    if (query.q) params = params.set('q', query.q);
    if (query.customerId) params = params.set('customerId', String(query.customerId));
    if (query.paymentMethod) params = params.set('paymentMethod', query.paymentMethod);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    return this.http.get<PagedResponse<PaymentListItem>>(this.base, { params });
  }

  getPaymentById(id: number): Observable<PaymentDetail> {
    return this.http.get<PaymentDetail>(`${this.base}/${id}`);
  }

  createPayment(request: CreatePaymentRequest): Observable<PaymentDetail> {
    return this.http.post<PaymentDetail>(this.base, request);
  }

  deletePayment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
