import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SankeyFlowItem } from '../models/sankey-flow-item.model';

@Injectable({ providedIn: 'root' })
export class SankeyReportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reports/sankey`;

  getQuoteToCash(start?: string, end?: string): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/quote-to-cash`, { params: this.dateParams(start, end) });
  }

  getJobStageFlow(): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/job-stage-flow`);
  }

  getMaterialToProduct(): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/material-to-product`);
  }

  getWorkerOrders(): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/worker-orders`);
  }

  getExpenseFlow(start?: string, end?: string): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/expense-flow`, { params: this.dateParams(start, end) });
  }

  getVendorSupplyChain(): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/vendor-supply-chain`);
  }

  getQualityRejection(start?: string, end?: string): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/quality-rejection`, { params: this.dateParams(start, end) });
  }

  getInventoryLocation(): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/inventory-location`);
  }

  getCustomerRevenue(start?: string, end?: string): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/customer-revenue`, { params: this.dateParams(start, end) });
  }

  getTrainingCompletion(): Observable<SankeyFlowItem[]> {
    return this.http.get<SankeyFlowItem[]>(`${this.base}/training-completion`);
  }

  private dateParams(start?: string, end?: string): HttpParams {
    let params = new HttpParams();
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return params;
  }
}
