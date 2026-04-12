import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { QcTemplate } from '../models/qc-template.model';
import { QcInspection } from '../models/qc-inspection.model';
import { LotRecord } from '../models/lot-record.model';
import { LotTraceability } from '../models/lot-traceability.model';
import { Gage, GageStatus, CalibrationRecord, CreateGageRequest, CreateCalibrationRecordRequest } from '../models/gage.model';

@Injectable({ providedIn: 'root' })
export class QualityService {
  private readonly http = inject(HttpClient);
  private readonly qualityBase = `${environment.apiUrl}/quality`;
  private readonly lotsBase = `${environment.apiUrl}/lots`;

  // ─── Templates ───

  getTemplates(): Observable<QcTemplate[]> {
    return this.http.get<QcTemplate[]>(`${this.qualityBase}/templates`);
  }

  createTemplate(data: {
    name: string;
    description?: string;
    partId?: number;
    items: { description: string; specification?: string; sortOrder: number; isRequired: boolean }[];
  }): Observable<QcTemplate> {
    return this.http.post<QcTemplate>(`${this.qualityBase}/templates`, data);
  }

  // ─── Inspections ───

  getInspections(params?: {
    jobId?: number;
    status?: string;
    lotNumber?: string;
  }): Observable<QcInspection[]> {
    let httpParams = new HttpParams();
    if (params?.jobId) httpParams = httpParams.set('jobId', params.jobId);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.lotNumber) httpParams = httpParams.set('lotNumber', params.lotNumber);
    return this.http.get<QcInspection[]>(`${this.qualityBase}/inspections`, { params: httpParams });
  }

  createInspection(data: {
    jobId?: number;
    productionRunId?: number;
    templateId?: number;
    lotNumber?: string;
    notes?: string;
  }): Observable<QcInspection> {
    return this.http.post<QcInspection>(`${this.qualityBase}/inspections`, data);
  }

  updateInspection(id: number, data: {
    status?: string;
    notes?: string;
    results?: {
      id?: number;
      checklistItemId?: number;
      description: string;
      passed: boolean;
      measuredValue?: string;
      notes?: string;
    }[];
  }): Observable<QcInspection> {
    return this.http.put<QcInspection>(`${this.qualityBase}/inspections/${id}`, data);
  }

  // ─── Lots ───

  getLotRecords(params?: {
    partId?: number;
    jobId?: number;
    search?: string;
  }): Observable<LotRecord[]> {
    let httpParams = new HttpParams();
    if (params?.partId) httpParams = httpParams.set('partId', params.partId);
    if (params?.jobId) httpParams = httpParams.set('jobId', params.jobId);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    return this.http.get<LotRecord[]>(this.lotsBase, { params: httpParams });
  }

  createLotRecord(data: {
    lotNumber?: string;
    partId: number;
    jobId?: number;
    productionRunId?: number;
    purchaseOrderLineId?: number;
    quantity: number;
    expirationDate?: string;
    supplierLotNumber?: string;
    notes?: string;
  }): Observable<LotRecord> {
    return this.http.post<LotRecord>(this.lotsBase, data);
  }

  getLotTraceability(lotNumber: string): Observable<LotTraceability> {
    return this.http.get<LotTraceability>(`${this.lotsBase}/${encodeURIComponent(lotNumber)}/trace`);
  }

  // ── Gages ──

  getGages(status?: GageStatus, search?: string): Observable<Gage[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<Gage[]>(`${this.qualityBase}/gages`, { params });
  }

  getGageById(id: number): Observable<Gage> {
    return this.http.get<Gage>(`${this.qualityBase}/gages/${id}`);
  }

  createGage(request: CreateGageRequest): Observable<Gage> {
    return this.http.post<Gage>(`${this.qualityBase}/gages`, request);
  }

  updateGage(id: number, request: Partial<CreateGageRequest>): Observable<Gage> {
    return this.http.patch<Gage>(`${this.qualityBase}/gages/${id}`, request);
  }

  getGagesDue(daysAhead = 30): Observable<Gage[]> {
    const params = new HttpParams().set('daysAhead', daysAhead);
    return this.http.get<Gage[]>(`${this.qualityBase}/gages/due`, { params });
  }

  getGageCalibrations(gageId: number): Observable<CalibrationRecord[]> {
    return this.http.get<CalibrationRecord[]>(`${this.qualityBase}/gages/${gageId}/calibrations`);
  }

  createCalibrationRecord(gageId: number, request: CreateCalibrationRecordRequest): Observable<CalibrationRecord> {
    return this.http.post<CalibrationRecord>(`${this.qualityBase}/gages/${gageId}/calibrations`, request);
  }
}
