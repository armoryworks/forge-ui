import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';

import { Observable } from 'rxjs';

import { PurchaseOrderDetail } from '../../features/purchase-orders/models/purchase-order-detail.model';
import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';
import { MobileReceiptRequest } from '../models/mobile-receipt-request.model';
import { randomId } from '../utils/random-id';

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

  receive(purchaseOrderId: number, request: MobileReceiptRequest): Observable<void> {
    return this.http.post<void>(`/api/v1/purchase-orders/${purchaseOrderId}/receive`, request, {
      headers: new HttpHeaders({ 'Idempotency-Key': randomId() }),
      context: this.silent(),
    });
  }

  private silent(): HttpContext {
    return new HttpContext().set(SILENT_HTTP_ERRORS, true);
  }
}
