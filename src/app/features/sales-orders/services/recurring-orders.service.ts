import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateRecurringOrderRequest,
  RecurringOrderDetail,
  RecurringOrderListItem,
} from '../models/recurring-order.model';

@Injectable({ providedIn: 'root' })
export class RecurringOrdersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/recurring-orders`;

  list(opts: { customerId?: number; isActive?: boolean } = {}): Observable<RecurringOrderListItem[]> {
    let params = new HttpParams();
    if (opts.customerId) params = params.set('customerId', String(opts.customerId));
    if (opts.isActive !== undefined) params = params.set('isActive', String(opts.isActive));
    return this.http.get<RecurringOrderListItem[]>(this.base, { params });
  }

  getById(id: number): Observable<RecurringOrderDetail> {
    return this.http.get<RecurringOrderDetail>(`${this.base}/${id}`);
  }

  create(request: CreateRecurringOrderRequest): Observable<RecurringOrderListItem> {
    return this.http.post<RecurringOrderListItem>(this.base, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
