import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  SpcCharacteristic,
  SpcMeasurement,
  SpcChartData,
  SpcControlLimits,
  SpcCapabilityReport,
  SpcOocEvent,
  SpcOocSeverity,
  SpcOocStatus,
  RecordMeasurementRequest,
} from '../models/spc.model';

@Injectable({ providedIn: 'root' })
export class SpcService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/spc';

  getCharacteristics(filters?: { partId?: number; operationId?: number; isActive?: boolean }): Observable<SpcCharacteristic[]> {
    let params = new HttpParams();
    if (filters?.partId != null) params = params.set('partId', filters.partId);
    if (filters?.operationId != null) params = params.set('operationId', filters.operationId);
    if (filters?.isActive != null) params = params.set('isActive', filters.isActive);
    return this.http.get<SpcCharacteristic[]>(`${this.baseUrl}/characteristics`, { params });
  }

  getCharacteristic(id: number): Observable<SpcCharacteristic> {
    return this.http.get<SpcCharacteristic>(`${this.baseUrl}/characteristics/${id}`);
  }

  createCharacteristic(request: Partial<SpcCharacteristic>): Observable<SpcCharacteristic> {
    return this.http.post<SpcCharacteristic>(`${this.baseUrl}/characteristics`, request);
  }

  updateCharacteristic(id: number, request: Partial<SpcCharacteristic>): Observable<SpcCharacteristic> {
    return this.http.put<SpcCharacteristic>(`${this.baseUrl}/characteristics/${id}`, request);
  }

  getChartData(characteristicId: number, lastN?: number): Observable<SpcChartData> {
    let params = new HttpParams();
    if (lastN != null) params = params.set('lastN', lastN);
    return this.http.get<SpcChartData>(`${this.baseUrl}/characteristics/${characteristicId}/chart`, { params });
  }

  recordMeasurements(request: RecordMeasurementRequest): Observable<SpcMeasurement[]> {
    return this.http.post<SpcMeasurement[]>(`${this.baseUrl}/measurements`, request);
  }

  getMeasurements(filters?: { characteristicId?: number; dateFrom?: string; dateTo?: string; jobId?: number }): Observable<SpcMeasurement[]> {
    let params = new HttpParams();
    if (filters?.characteristicId != null) params = params.set('characteristicId', filters.characteristicId);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
    if (filters?.jobId != null) params = params.set('jobId', filters.jobId);
    return this.http.get<SpcMeasurement[]>(`${this.baseUrl}/measurements`, { params });
  }

  recalculateLimits(characteristicId: number, fromSubgroup?: number, toSubgroup?: number): Observable<SpcControlLimits> {
    let params = new HttpParams();
    if (fromSubgroup != null) params = params.set('fromSubgroup', fromSubgroup);
    if (toSubgroup != null) params = params.set('toSubgroup', toSubgroup);
    return this.http.post<SpcControlLimits>(`${this.baseUrl}/characteristics/${characteristicId}/recalculate-limits`, null, { params });
  }

  getCapabilityReport(characteristicId: number): Observable<SpcCapabilityReport> {
    return this.http.get<SpcCapabilityReport>(`${this.baseUrl}/capability/${characteristicId}`);
  }

  getOocEvents(filters?: { status?: SpcOocStatus; severity?: SpcOocSeverity; characteristicId?: number }): Observable<SpcOocEvent[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.severity) params = params.set('severity', filters.severity);
    if (filters?.characteristicId != null) params = params.set('characteristicId', filters.characteristicId);
    return this.http.get<SpcOocEvent[]>(`${this.baseUrl}/out-of-control`, { params });
  }

  acknowledgeOoc(id: number, notes?: string): Observable<SpcOocEvent> {
    return this.http.post<SpcOocEvent>(`${this.baseUrl}/out-of-control/${id}/acknowledge`, { notes });
  }

  createCapaFromOoc(id: number): Observable<SpcOocEvent> {
    return this.http.post<SpcOocEvent>(`${this.baseUrl}/out-of-control/${id}/create-capa`, null);
  }
}
