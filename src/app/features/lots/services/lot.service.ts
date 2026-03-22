import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { LotListItem } from '../models/lot-list-item.model';
import { LotTrace } from '../models/lot-trace.model';

@Injectable({ providedIn: 'root' })
export class LotService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/lots`;

  getLots(search?: string, partId?: number, jobId?: number): Observable<LotListItem[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (partId != null) params = params.set('partId', partId);
    if (jobId != null) params = params.set('jobId', jobId);
    return this.http.get<LotListItem[]>(this.base, { params });
  }

  trace(lotNumber: string): Observable<LotTrace> {
    return this.http.get<LotTrace>(`${this.base}/${encodeURIComponent(lotNumber)}/trace`);
  }

  create(request: {
    partId: number;
    quantity: number;
    jobId?: number | null;
    purchaseOrderLineId?: number | null;
    expirationDate?: string | null;
    supplierLotNumber?: string | null;
    notes?: string | null;
  }): Observable<LotListItem> {
    return this.http.post<LotListItem>(this.base, request);
  }
}
