import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CreateProductionRunRequest } from '../models/create-production-run-request.model';
import { ProductionRun } from '../models/production-run.model';
import { UpdateProductionRunRequest } from '../models/update-production-run-request.model';

@Injectable({ providedIn: 'root' })
export class ProductionRunsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/jobs';

  getRuns(jobId: number): Observable<ProductionRun[]> {
    return this.http.get<ProductionRun[]>(`${this.baseUrl}/${jobId}/production-runs`);
  }

  createRun(jobId: number, request: CreateProductionRunRequest): Observable<ProductionRun> {
    return this.http.post<ProductionRun>(`${this.baseUrl}/${jobId}/production-runs`, request);
  }

  updateRun(jobId: number, runId: number, request: UpdateProductionRunRequest): Observable<ProductionRun> {
    return this.http.put<ProductionRun>(`${this.baseUrl}/${jobId}/production-runs/${runId}`, request);
  }

  receiveToStock(jobId: number, runId: number, locationId: number | null = null, surplusLocationId: number | null = null): Observable<ProductionRun> {
    let params = new HttpParams();
    if (locationId != null) params = params.set('locationId', locationId);
    if (surplusLocationId != null) params = params.set('surplusLocationId', surplusLocationId);
    return this.http.post<ProductionRun>(`${this.baseUrl}/${jobId}/production-runs/${runId}/receive-to-stock`, {}, { params });
  }
}
