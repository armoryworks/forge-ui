import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CustomerReturnListItem } from '../models/customer-return-list-item.model';
import { CustomerReturnDetail } from '../models/customer-return-detail.model';

@Injectable({ providedIn: 'root' })
export class CustomerReturnService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/customer-returns`;

  getReturns(customerId?: number, status?: string): Observable<CustomerReturnListItem[]> {
    let params = new HttpParams();
    if (customerId != null) params = params.set('customerId', customerId);
    if (status) params = params.set('status', status);
    return this.http.get<CustomerReturnListItem[]>(this.base, { params });
  }

  getById(id: number): Observable<CustomerReturnDetail> {
    return this.http.get<CustomerReturnDetail>(`${this.base}/${id}`);
  }

  create(request: {
    customerId: number;
    originalJobId: number;
    reason: string;
    notes?: string;
    returnDate: string;
  }): Observable<CustomerReturnDetail> {
    return this.http.post<CustomerReturnDetail>(this.base, request);
  }

  update(id: number, request: {
    reason?: string;
    notes?: string;
    returnDate?: string;
    reworkJobId?: number | null;
    inspectionNotes?: string;
  }): Observable<CustomerReturnDetail> {
    return this.http.put<CustomerReturnDetail>(`${this.base}/${id}`, request);
  }

  resolve(id: number, inspectionNotes?: string): Observable<CustomerReturnDetail> {
    return this.http.post<CustomerReturnDetail>(`${this.base}/${id}/resolve`, { inspectionNotes });
  }

  close(id: number): Observable<CustomerReturnDetail> {
    return this.http.post<CustomerReturnDetail>(`${this.base}/${id}/close`, {});
  }
}
