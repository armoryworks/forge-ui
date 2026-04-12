import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  MrpRun,
  MrpPlannedOrder,
  MrpPlannedOrderStatus,
  MrpException,
  MrpPartPlan,
  MrpPegging,
  MasterSchedule,
  MasterScheduleDetail,
  MasterScheduleStatus,
  MpsVsActual,
  DemandForecast,
  ExecuteMrpRunRequest,
  CreateMasterScheduleRequest,
  UpdateMasterScheduleRequest,
  GenerateForecastRequest,
} from '../models/mrp.model';

@Injectable({ providedIn: 'root' })
export class MrpService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/mrp`;

  // === MRP Runs ===

  getRuns(): Observable<MrpRun[]> {
    return this.http.get<MrpRun[]>(`${this.base}/runs`);
  }

  getRun(id: number): Observable<MrpRun> {
    return this.http.get<MrpRun>(`${this.base}/runs/${id}`);
  }

  executeRun(request: ExecuteMrpRunRequest): Observable<MrpRun> {
    return this.http.post<MrpRun>(`${this.base}/runs`, request);
  }

  simulateRun(request: ExecuteMrpRunRequest): Observable<MrpRun> {
    return this.http.post<MrpRun>(`${this.base}/runs/simulate`, request);
  }

  // === Planned Orders ===

  getPlannedOrders(mrpRunId?: number, status?: MrpPlannedOrderStatus): Observable<MrpPlannedOrder[]> {
    const params: Record<string, string> = {};
    if (mrpRunId) params['mrpRunId'] = mrpRunId.toString();
    if (status) params['status'] = status;
    return this.http.get<MrpPlannedOrder[]>(`${this.base}/planned-orders`, { params });
  }

  updatePlannedOrder(id: number, isFirmed?: boolean, notes?: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/planned-orders/${id}`, { isFirmed, notes });
  }

  releasePlannedOrder(id: number): Observable<{ createdEntityType: string; createdEntityId: number }> {
    return this.http.post<{ createdEntityType: string; createdEntityId: number }>(`${this.base}/planned-orders/${id}/release`, {});
  }

  bulkReleasePlannedOrders(ids: number[]): Observable<{ createdEntityType: string; createdEntityId: number }[]> {
    return this.http.post<{ createdEntityType: string; createdEntityId: number }[]>(`${this.base}/planned-orders/bulk-release`, { ids });
  }

  deletePlannedOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/planned-orders/${id}`);
  }

  // === Exceptions ===

  getExceptions(mrpRunId?: number, unresolvedOnly?: boolean): Observable<MrpException[]> {
    const params: Record<string, string> = {};
    if (mrpRunId) params['mrpRunId'] = mrpRunId.toString();
    if (unresolvedOnly !== undefined) params['unresolvedOnly'] = unresolvedOnly.toString();
    return this.http.get<MrpException[]>(`${this.base}/exceptions`, { params });
  }

  resolveException(id: number, resolutionNotes?: string): Observable<void> {
    return this.http.post<void>(`${this.base}/exceptions/${id}/resolve`, { resolutionNotes });
  }

  // === Part Plan & Pegging ===

  getPartPlan(runId: number, partId: number): Observable<MrpPartPlan> {
    return this.http.get<MrpPartPlan>(`${this.base}/runs/${runId}/parts/${partId}/plan`);
  }

  getPegging(runId: number, partId: number): Observable<MrpPegging[]> {
    return this.http.get<MrpPegging[]>(`${this.base}/runs/${runId}/parts/${partId}/pegging`);
  }

  // === Master Schedules ===

  getMasterSchedules(status?: MasterScheduleStatus): Observable<MasterSchedule[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<MasterSchedule[]>(`${this.base}/master-schedules`, { params });
  }

  getMasterSchedule(id: number): Observable<MasterScheduleDetail> {
    return this.http.get<MasterScheduleDetail>(`${this.base}/master-schedules/${id}`);
  }

  createMasterSchedule(request: CreateMasterScheduleRequest): Observable<MasterScheduleDetail> {
    return this.http.post<MasterScheduleDetail>(`${this.base}/master-schedules`, request);
  }

  updateMasterSchedule(id: number, request: UpdateMasterScheduleRequest): Observable<MasterScheduleDetail> {
    return this.http.put<MasterScheduleDetail>(`${this.base}/master-schedules/${id}`, request);
  }

  activateMasterSchedule(id: number): Observable<MasterSchedule> {
    return this.http.post<MasterSchedule>(`${this.base}/master-schedules/${id}/activate`, {});
  }

  getMpsVsActual(id: number): Observable<MpsVsActual[]> {
    return this.http.get<MpsVsActual[]>(`${this.base}/master-schedules/${id}/vs-actual`);
  }

  // === Demand Forecasts ===

  getForecasts(partId?: number): Observable<DemandForecast[]> {
    const params: Record<string, string> = {};
    if (partId) params['partId'] = partId.toString();
    return this.http.get<DemandForecast[]>(`${this.base}/forecasts`, { params });
  }

  generateForecast(request: GenerateForecastRequest): Observable<DemandForecast> {
    return this.http.post<DemandForecast>(`${this.base}/forecasts`, request);
  }

  approveForecast(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/forecasts/${id}/approve`, {});
  }

  applyForecastToMps(forecastId: number, masterScheduleId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/forecasts/${forecastId}/apply`, { masterScheduleId });
  }

  createForecastOverride(forecastId: number, periodStart: string, overrideQuantity: number, reason?: string): Observable<unknown> {
    return this.http.post(`${this.base}/forecasts/${forecastId}/overrides`, { periodStart, overrideQuantity, reason });
  }
}
