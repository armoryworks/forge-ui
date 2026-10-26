import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PaymentRunListItem } from '../models/payment-run-list-item.model';
import { PaymentRunDetail } from '../models/payment-run-detail.model';
import { CreatePaymentRunRequest } from '../models/create-payment-run-request.model';

@Injectable({ providedIn: 'root' })
export class PaymentRunService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/payment-runs`;

  getRuns(status?: string | null): Observable<PaymentRunListItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<PaymentRunListItem[]>(this.base, { params });
  }

  getById(id: number): Observable<PaymentRunDetail> {
    return this.http.get<PaymentRunDetail>(`${this.base}/${id}`);
  }

  /** Records the run and pays it vendor by vendor; an interrupted run comes back Interrupted. */
  create(request: CreatePaymentRunRequest): Observable<PaymentRunDetail> {
    return this.http.post<PaymentRunDetail>(this.base, request);
  }

  /** Pays only the vendors an interrupted run has not paid yet. */
  resume(id: number): Observable<PaymentRunDetail> {
    return this.http.post<PaymentRunDetail>(`${this.base}/${id}/resume`, {});
  }

  cancel(id: number): Observable<PaymentRunDetail> {
    return this.http.post<PaymentRunDetail>(`${this.base}/${id}/cancel`, {});
  }
}
