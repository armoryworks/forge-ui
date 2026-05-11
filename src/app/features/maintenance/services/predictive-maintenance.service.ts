import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  MaintenancePrediction,
  MaintenancePredictionSeverity,
  MaintenancePredictionStatus,
  PredictiveMaintenanceDashboard,
  ResolvePredictionRequest,
} from '../models/prediction.model';

@Injectable({ providedIn: 'root' })
export class PredictiveMaintenanceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/predictions`;

  list(opts: {
    workCenterId?: number;
    severity?: MaintenancePredictionSeverity;
    status?: MaintenancePredictionStatus;
  } = {}): Observable<MaintenancePrediction[]> {
    let params = new HttpParams();
    if (opts.workCenterId) params = params.set('workCenterId', String(opts.workCenterId));
    if (opts.severity) params = params.set('severity', opts.severity);
    if (opts.status) params = params.set('status', opts.status);
    return this.http.get<MaintenancePrediction[]>(this.base, { params });
  }

  getDashboard(): Observable<PredictiveMaintenanceDashboard> {
    return this.http.get<PredictiveMaintenanceDashboard>(`${this.base}/dashboard`);
  }

  acknowledge(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/acknowledge`, {});
  }

  scheduleMaintenance(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/schedule-maintenance`, {});
  }

  resolve(id: number, request: ResolvePredictionRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/resolve`, request);
  }

  markFalsePositive(id: number, request: ResolvePredictionRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/false-positive`, request);
  }
}
