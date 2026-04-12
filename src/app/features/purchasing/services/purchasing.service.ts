import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  RfqListItem,
  RfqDetail,
  CreateRfqRequest,
  RecordVendorResponseRequest,
  SendRfqToVendorsRequest,
  RfqVendorResponse,
} from '../models/rfq.model';

@Injectable({ providedIn: 'root' })
export class PurchasingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/purchasing`;

  getRfqs(status?: string, search?: string): Observable<RfqListItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<RfqListItem[]>(`${this.base}/rfqs`, { params });
  }

  getRfqById(id: number): Observable<RfqDetail> {
    return this.http.get<RfqDetail>(`${this.base}/rfqs/${id}`);
  }

  createRfq(request: CreateRfqRequest): Observable<RfqListItem> {
    return this.http.post<RfqListItem>(`${this.base}/rfqs`, request);
  }

  updateRfq(id: number, request: CreateRfqRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/rfqs/${id}`, request);
  }

  sendToVendors(id: number, request: SendRfqToVendorsRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/rfqs/${id}/send`, request);
  }

  recordVendorResponse(id: number, request: RecordVendorResponseRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/rfqs/${id}/responses`, request);
  }

  compareResponses(id: number): Observable<RfqVendorResponse[]> {
    return this.http.get<RfqVendorResponse[]>(`${this.base}/rfqs/${id}/compare`);
  }

  awardRfq(id: number, responseId: number): Observable<{ purchaseOrderId: number }> {
    return this.http.post<{ purchaseOrderId: number }>(`${this.base}/rfqs/${id}/award/${responseId}`, {});
  }
}
