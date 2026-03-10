import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SalesOrderListItem } from '../models/sales-order-list-item.model';
import { SalesOrderDetail } from '../models/sales-order-detail.model';
import { CreateSalesOrderRequest } from '../models/create-sales-order-request.model';

@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/orders`;

  getSalesOrders(customerId?: number, status?: string, search?: string): Observable<SalesOrderListItem[]> {
    let params = new HttpParams();
    if (customerId) params = params.set('customerId', String(customerId));
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<SalesOrderListItem[]>(this.base, { params });
  }

  getSalesOrderById(id: number): Observable<SalesOrderDetail> {
    return this.http.get<SalesOrderDetail>(`${this.base}/${id}`);
  }

  createSalesOrder(request: CreateSalesOrderRequest): Observable<SalesOrderDetail> {
    return this.http.post<SalesOrderDetail>(this.base, request);
  }

  updateSalesOrder(id: number, request: {
    shippingAddressId?: number;
    billingAddressId?: number;
    creditTerms?: string;
    requestedDeliveryDate?: string;
    customerPO?: string;
    notes?: string;
    taxRate?: number;
  }): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, request);
  }

  confirmSalesOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/confirm`, {});
  }

  cancelSalesOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/cancel`, {});
  }

  deleteSalesOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
