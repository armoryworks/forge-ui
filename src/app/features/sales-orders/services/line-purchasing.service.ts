import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { LinkedPurchaseRequest } from '../models/linked-purchase-request.model';
import { LinkedPurchaseType } from '../models/linked-purchase-type.type';
import { DropShipDeliveryRequest } from '../models/drop-ship-delivery-request.model';

/** Drop-ship and back-to-back purchase orders raised from sales order lines. */
@Injectable({ providedIn: 'root' })
export class LinkedPurchasingService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  createPurchase(type: LinkedPurchaseType, salesOrderId: number, lineId: number, body: LinkedPurchaseRequest): Observable<{ purchaseOrderId: number }> {
    const path = type === 'DropShip' ? 'drop-ship' : 'back-to-back';
    return this.http.post<{ purchaseOrderId: number }>(`${this.base}/sales-orders/${salesOrderId}/lines/${lineId}/${path}`, body);
  }

  confirmDropShipDelivery(purchaseOrderId: number, lineId: number, body: DropShipDeliveryRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/purchase-orders/${purchaseOrderId}/lines/${lineId}/drop-ship-confirm`, body);
  }
}
