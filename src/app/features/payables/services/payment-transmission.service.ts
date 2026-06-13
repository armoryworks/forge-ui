import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PaymentTransmissionListItem } from '../models/payment-transmission-list-item.model';

// ⚡ ACCOUNTING BOUNDARY — bank transmission triage for electronic vendor payments.
@Injectable({ providedIn: 'root' })
export class PaymentTransmissionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/payment-transmissions`;

  getPaymentTransmissions(status?: string, sourceType?: string): Observable<PaymentTransmissionListItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (sourceType) params = params.set('sourceType', sourceType);
    return this.http.get<PaymentTransmissionListItem[]>(this.base, { params });
  }

  /** Failed/Cancelled → Queued with a fresh 5-attempt cycle. 409 otherwise. */
  retryPaymentTransmission(id: number): Observable<PaymentTransmissionListItem> {
    return this.http.post<PaymentTransmissionListItem>(`${this.base}/${id}/retry`, {});
  }
}
