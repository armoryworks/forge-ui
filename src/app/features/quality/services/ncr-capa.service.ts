import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CapaStatus } from '../models/capa-status.model';
import { CapaTask } from '../models/capa-task.model';
import { CapaType } from '../models/capa-type.model';
import { CorrectiveAction } from '../models/corrective-action.model';
import { NcrStatus } from '../models/ncr-status.model';
import { NcrType } from '../models/ncr-type.model';
import { NonConformance } from '../models/non-conformance.model';

@Injectable({ providedIn: 'root' })
export class NcrCapaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/quality';

  // ── NCR ──────────────────────────────────────────────────

  getNcrs(filters?: {
    type?: NcrType;
    status?: NcrStatus;
    partId?: number;
    jobId?: number;
    vendorId?: number;
    customerId?: number;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<NonConformance[]> {
    let params = new HttpParams();
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.partId) params = params.set('partId', filters.partId.toString());
    if (filters?.jobId) params = params.set('jobId', filters.jobId.toString());
    if (filters?.vendorId) params = params.set('vendorId', filters.vendorId.toString());
    if (filters?.customerId) params = params.set('customerId', filters.customerId.toString());
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
    return this.http.get<NonConformance[]>(`${this.baseUrl}/ncrs`, { params });
  }

  getNcr(id: number): Observable<NonConformance> {
    return this.http.get<NonConformance>(`${this.baseUrl}/ncrs/${id}`);
  }

  createNcr(request: Partial<NonConformance>): Observable<NonConformance> {
    return this.http.post<NonConformance>(`${this.baseUrl}/ncrs`, request);
  }

  updateNcr(id: number, request: Partial<NonConformance>): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/ncrs/${id}`, request);
  }

  dispositionNcr(id: number, disposition: { code: string; notes?: string; reworkInstructions?: string }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/ncrs/${id}/disposition`, disposition);
  }

  createCapaFromNcr(ncrId: number, ownerId: number): Observable<CorrectiveAction> {
    return this.http.post<CorrectiveAction>(`${this.baseUrl}/ncrs/${ncrId}/create-capa`, { ownerId });
  }

  // ── CAPA ─────────────────────────────────────────────────

  getCapas(filters?: {
    status?: CapaStatus;
    type?: CapaType;
    ownerId?: number;
    priority?: number;
    dueDateFrom?: string;
    dueDateTo?: string;
  }): Observable<CorrectiveAction[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.ownerId) params = params.set('ownerId', filters.ownerId.toString());
    if (filters?.priority) params = params.set('priority', filters.priority.toString());
    if (filters?.dueDateFrom) params = params.set('dueDateFrom', filters.dueDateFrom);
    if (filters?.dueDateTo) params = params.set('dueDateTo', filters.dueDateTo);
    return this.http.get<CorrectiveAction[]>(`${this.baseUrl}/capas`, { params });
  }

  getCapa(id: number): Observable<CorrectiveAction> {
    return this.http.get<CorrectiveAction>(`${this.baseUrl}/capas/${id}`);
  }

  createCapa(request: Partial<CorrectiveAction>): Observable<CorrectiveAction> {
    return this.http.post<CorrectiveAction>(`${this.baseUrl}/capas`, request);
  }

  updateCapa(id: number, request: Partial<CorrectiveAction>): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/capas/${id}`, request);
  }

  advanceCapaPhase(id: number): Observable<CorrectiveAction> {
    return this.http.post<CorrectiveAction>(`${this.baseUrl}/capas/${id}/advance`, {});
  }

  // ── CAPA Tasks ───────────────────────────────────────────

  getCapaTasks(capaId: number): Observable<CapaTask[]> {
    return this.http.get<CapaTask[]>(`${this.baseUrl}/capas/${capaId}/tasks`);
  }

  createCapaTask(capaId: number, request: Partial<CapaTask>): Observable<CapaTask> {
    return this.http.post<CapaTask>(`${this.baseUrl}/capas/${capaId}/tasks`, request);
  }

  updateCapaTask(capaId: number, taskId: number, request: Partial<CapaTask>): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/capas/${capaId}/tasks/${taskId}`, request);
  }
}
