import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Estimate, EstimateDetail, EstimateStatus } from '../models/estimate.model';

export interface CreateEstimateRequest {
  customerId: number;
  title: string;
  description?: string;
  estimatedAmount: number;
  validUntil?: string;
  notes?: string;
}

export interface UpdateEstimateRequest {
  title?: string;
  description?: string;
  estimatedAmount?: number;
  status?: EstimateStatus;
  validUntil?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class EstimateService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/estimates`;

  getEstimates(customerId?: number, status?: EstimateStatus): Observable<Estimate[]> {
    let params = new HttpParams();
    if (customerId) params = params.set('customerId', String(customerId));
    if (status) params = params.set('status', status);
    return this.http.get<Estimate[]>(this.base, { params });
  }

  getEstimate(id: number): Observable<EstimateDetail> {
    return this.http.get<EstimateDetail>(`${this.base}/${id}`);
  }

  createEstimate(req: CreateEstimateRequest): Observable<Estimate> {
    return this.http.post<Estimate>(this.base, req);
  }

  updateEstimate(id: number, req: UpdateEstimateRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, req);
  }

  deleteEstimate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  convertToQuote(id: number): Observable<{ id: number; quoteNumber: string }> {
    return this.http.post<{ id: number; quoteNumber: string }>(`${this.base}/${id}/convert`, {});
  }
}
