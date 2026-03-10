import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PaymentListItem } from '../models/payment-list-item.model';
import { PaymentDetail } from '../models/payment-detail.model';
import { CreatePaymentRequest } from '../models/create-payment-request.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/payments`;

  getPayments(customerId?: number): Observable<PaymentListItem[]> {
    let params = new HttpParams();
    if (customerId) params = params.set('customerId', String(customerId));
    return this.http.get<PaymentListItem[]>(this.base, { params });
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
