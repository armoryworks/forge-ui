import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';

import { Observable, map } from 'rxjs';

import { PurchaseOrderDetail } from '../../features/purchase-orders/models/purchase-order-detail.model';
import { StorageLocationFlat } from '../../features/inventory/models/storage-location-flat.model';
import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';
import { MobileReceiptRequest } from '../models/mobile-receipt-request.model';

/**
 * Dock receiving from the phone. Online only: a receipt never goes to the
 * offline queue, and failures come back silent so the page can show the
 * server's own message.
 */
@Injectable({ providedIn: 'root' })
export class MobileReceivingService {
  private readonly http = inject(HttpClient);

  purchaseOrder(id: number): Observable<PurchaseOrderDetail> {
    return this.http.get<PurchaseOrderDetail>(`/api/v1/purchase-orders/${id}`, { context: this.silent() });
  }

  activeBins(): Observable<StorageLocationFlat[]> {
    return this.http
      .get<{ items: StorageLocationFlat[] }>('/api/v1/inventory/locations/bins', {
        params: { activeOnly: 'true', pageSize: '100' },
        context: this.silent(),
      })
      .pipe(map((res) => res.items ?? []));
  }

  receive(purchaseOrderId: number, request: MobileReceiptRequest): Observable<void> {
    return this.http.post<void>(`/api/v1/purchase-orders/${purchaseOrderId}/receive`, request, {
      headers: new HttpHeaders({ 'Idempotency-Key': crypto.randomUUID() }),
      context: this.silent(),
    });
  }

  private silent(): HttpContext {
    return new HttpContext().set(SILENT_HTTP_ERRORS, true);
  }
}
