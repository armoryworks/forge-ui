import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PurchaseOrderListItem } from '../models/purchase-order-list-item.model';
import { PurchaseOrderDetail } from '../models/purchase-order-detail.model';
import { CreatePurchaseOrderRequest } from '../models/create-purchase-order-request.model';
import { ReceiveItemsRequest } from '../models/receive-items-request.model';

@Injectable({ providedIn: 'root' })
export class PurchaseOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/purchase-orders`;

  getPurchaseOrders(vendorId?: number, jobId?: number, status?: string, search?: string): Observable<PurchaseOrderListItem[]> {
    let params = new HttpParams();
    if (vendorId) params = params.set('vendorId', String(vendorId));
    if (jobId) params = params.set('jobId', String(jobId));
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<PurchaseOrderListItem[]>(this.base, { params });
  }

  getPurchaseOrderById(id: number): Observable<PurchaseOrderDetail> {
    return this.http.get<PurchaseOrderDetail>(`${this.base}/${id}`);
  }

  createPurchaseOrder(request: CreatePurchaseOrderRequest): Observable<PurchaseOrderDetail> {
    return this.http.post<PurchaseOrderDetail>(this.base, request);
  }

  updatePurchaseOrder(id: number, request: { notes?: string; expectedDeliveryDate?: string }): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, request);
  }

  submitPurchaseOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/submit`, {});
  }

  acknowledgePurchaseOrder(id: number, expectedDeliveryDate?: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/acknowledge`, { expectedDeliveryDate });
  }

  receiveItems(id: number, request: ReceiveItemsRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/receive`, request);
  }

  cancelPurchaseOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/cancel`, {});
  }

  closePurchaseOrder(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/close`, {});
  }

  deletePurchaseOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
