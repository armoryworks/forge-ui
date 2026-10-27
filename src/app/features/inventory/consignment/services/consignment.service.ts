import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { ConsignmentAgreement } from '../models/consignment-agreement.model';
import { ConsignmentReconciliation } from '../models/consignment-reconciliation.model';
import { ConsignmentStockSummary } from '../models/consignment-stock-summary.model';
import { ConsignmentTransaction } from '../models/consignment-transaction.model';
import { ConsignmentTransactionRequest } from '../models/consignment-transaction-request.model';
import { ReconcileConsignmentRequest } from '../models/reconcile-consignment-request.model';
import { SaveConsignmentAgreementRequest } from '../models/save-consignment-agreement-request.model';

@Injectable({ providedIn: 'root' })
export class ConsignmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/consignment-agreements`;

  agreements(): Observable<ConsignmentAgreement[]> {
    return this.http.get<ConsignmentAgreement[]>(this.base);
  }

  stockSummary(): Observable<ConsignmentStockSummary> {
    return this.http.get<ConsignmentStockSummary>(`${this.base}/stock-summary`);
  }

  transactions(id: number): Observable<ConsignmentTransaction[]> {
    return this.http.get<ConsignmentTransaction[]>(`${this.base}/${id}/transactions`);
  }

  create(request: SaveConsignmentAgreementRequest): Observable<ConsignmentAgreement> {
    return this.http.post<ConsignmentAgreement>(this.base, request);
  }

  update(id: number, request: SaveConsignmentAgreementRequest): Observable<ConsignmentAgreement> {
    return this.http.put<ConsignmentAgreement>(`${this.base}/${id}`, request);
  }

  receive(id: number, request: ConsignmentTransactionRequest): Observable<ConsignmentTransaction> {
    return this.http.post<ConsignmentTransaction>(`${this.base}/${id}/receive`, request);
  }

  consume(id: number, request: ConsignmentTransactionRequest): Observable<ConsignmentTransaction> {
    return this.http.post<ConsignmentTransaction>(`${this.base}/${id}/consume`, request);
  }

  reconcile(id: number, request: ReconcileConsignmentRequest): Observable<ConsignmentReconciliation> {
    return this.http.post<ConsignmentReconciliation>(`${this.base}/${id}/reconcile`, request);
  }
}
