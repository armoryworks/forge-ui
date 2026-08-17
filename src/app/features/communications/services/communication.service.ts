import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CommunicationDetail } from '../models/communication-detail.model';
import { SalesOrderAuthorization } from '../models/sales-order-authorization.model';

/** One approved draft: the order it created and the attestation authorizing it. */
export interface ApproveDraftResult {
  salesOrderId: number;
  orderNumber: string;
  attestationId: number;
}

export interface ApproveDraftRequest {
  customerId: number;
  /** The document the authorization actually is — usually the PO PDF. */
  authorizingArtifactId: number;
  customerPo: string | null;
  requestedDeliveryDate: string | null;
  taxRate: number;
  lines: { partId: number | null; description: string; quantity: number; unitPrice: number; notes: string | null }[];
  supportedByAttestationId: number | null;
  note: string | null;
}

@Injectable({ providedIn: 'root' })
export class CommunicationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/communications`;
  // Sales-order detail routes live under `orders` (SalesOrdersController);
  // `sales-orders` is the LIST controller and has no `{id}/authorization`.
  private readonly ordersBase = `${environment.apiUrl}/orders`;

  getDetail(id: number): Observable<CommunicationDetail> {
    return this.http.get<CommunicationDetail>(`${this.base}/${id}`);
  }

  /**
   * The only path from an inbound message to an order. Sends the reviewer's own
   * line values — what they approved on screen, which may differ from what was
   * extracted.
   */
  approveDraft(communicationId: number, body: ApproveDraftRequest): Observable<ApproveDraftResult> {
    return this.http.post<ApproveDraftResult>(`${this.base}/${communicationId}/approve-draft`, body);
  }

  /** Null when the order was keyed in or converted from a quote. */
  getAuthorization(salesOrderId: number): Observable<SalesOrderAuthorization | null> {
    return this.http.get<SalesOrderAuthorization | null>(`${this.ordersBase}/${salesOrderId}/authorization`);
  }
}
