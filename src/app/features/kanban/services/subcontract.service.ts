import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ReceiveBackSubcontractRequest } from '../models/receive-back-subcontract-request.model';
import { SendOutSubcontractRequest } from '../models/send-out-subcontract-request.model';
import { SubcontractOperation } from '../models/subcontract-operation.model';
import { SubcontractOrder } from '../models/subcontract-order.model';

@Injectable({ providedIn: 'root' })
export class SubcontractService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getOperations(jobId: number): Observable<SubcontractOperation[]> {
    return this.http.get<SubcontractOperation[]>(`${this.baseUrl}/jobs/${jobId}/subcontract-operations`);
  }

  getOrders(jobId: number): Observable<SubcontractOrder[]> {
    return this.http.get<SubcontractOrder[]>(`${this.baseUrl}/jobs/${jobId}/subcontract-orders`);
  }

  sendOut(jobId: number, operationId: number, request: SendOutSubcontractRequest): Observable<SubcontractOrder> {
    return this.http.post<SubcontractOrder>(`${this.baseUrl}/jobs/${jobId}/operations/${operationId}/send-out`, request);
  }

  receiveBack(orderId: number, request: ReceiveBackSubcontractRequest): Observable<SubcontractOrder> {
    return this.http.post<SubcontractOrder>(`${this.baseUrl}/subcontract-orders/${orderId}/receive`, request);
  }
}
