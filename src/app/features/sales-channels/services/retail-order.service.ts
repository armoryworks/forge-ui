import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CreateRetailOrderRequest } from '../models/create-retail-order-request.model';
import { RetailOrderCreated } from '../models/sales-order-list-item.model';

/**
 * Manual retail order entry — walk-ins, phone orders, trade shows.
 *
 * <p>Hits the same endpoint channel importers use. That is deliberate: one path
 * means a hand-keyed order and an imported one are the same kind of record, and
 * both get the same activity logging, validation and capability gating.</p>
 */
@Injectable({ providedIn: 'root' })
export class RetailOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/retail-orders`;

  /**
   * Idempotent on (channel, externalOrderNumber): re-posting an order that
   * already exists returns 200 with the existing order rather than a duplicate.
   */
  createOrder(body: CreateRetailOrderRequest): Observable<RetailOrderCreated> {
    return this.http.post<RetailOrderCreated>(this.base, body);
  }
}
