import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { catchError, Observable, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ShopFloorOverview } from '../models/shop-floor-overview.model';
import { ClockWorker } from '../models/clock-worker.model';
import { KioskTerminal, Team } from '../models/kiosk-terminal.model';
import { ScanIdentification } from '../models/scan-identification.model';
import { JobOperations } from '../models/job-operations.model';
import { JobOperationsConfig } from '../models/job-operations-config.model';
import { JobOperationTimerResult } from '../models/job-operation-timer-result.model';
import { JobOperationTimerStopResult } from '../models/job-operation-timer-stop-result.model';
import { JobOperationProgressResult } from '../models/job-operation-progress-result.model';
import { UpdateJobOperationProgressRequest } from '../models/update-job-operation-progress-request.model';
import { OperationTimerEntryType } from '../models/operation-timer-entry-type.type';
import { RunningTimer } from '../models/running-timer.model';
import { StopTimerTarget } from '../models/stop-timer-target.model';
import { JobAdvanceResult, JobStatus } from '../../../shared/models/mobile-api.model';
import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';

@Injectable({ providedIn: 'root' })
export class ShopFloorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/display/shop-floor`;

  getOverview(teamId?: number): Observable<ShopFloorOverview> {
    let params = new HttpParams();
    if (teamId) params = params.set('teamId', teamId);
    return this.http.get<ShopFloorOverview>(this.base, { params });
  }

  getClockStatus(teamId?: number): Observable<ClockWorker[]> {
    let params = new HttpParams();
    if (teamId) params = params.set('teamId', teamId);
    return this.http.get<ClockWorker[]>(`${this.base}/clock-status`, { params });
  }

  clockInOut(userId: number, eventType: string): Observable<void> {
    return this.http.post<void>(`${this.base}/clock`, { userId, eventType });
  }

  identifyScan(scanValue: string): Observable<ScanIdentification> {
    return this.http.post<ScanIdentification>(`${this.base}/identify-scan`, { scanValue });
  }

  assignJob(jobId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/assign-job`, { jobId, userId });
  }

  startTimer(jobId: number): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/time-tracking/timer/start`, {
      jobId, category: null, notes: null,
    });
  }

  stopTimer(target?: StopTimerTarget): Observable<unknown> {
    const url = `${environment.apiUrl}/time-tracking/timer/stop`;
    const body = { notes: null, ...target };
    return target ? this.http.post(url, body, this.silent()) : this.http.post(url, body);
  }

  getActiveTimers(): Observable<RunningTimer[]> {
    return this.http.get<RunningTimer[]>(`${environment.apiUrl}/time-tracking/timers/active`, this.silent());
  }

  getConfig(): Observable<JobOperationsConfig> {
    return this.http.get<JobOperationsConfig>(`${environment.apiUrl}/job-operations/config`, this.silent()).pipe(
      catchError(() => of({ operationTracking: false })),
    );
  }

  getOperations(jobId: number): Observable<JobOperations> {
    return this.http.get<JobOperations>(`${environment.apiUrl}/jobs/${jobId}/operations`, this.silent());
  }

  startOperationTimer(jobId: number, operationId: number, entryType: OperationTimerEntryType = 'Run'): Observable<JobOperationTimerResult> {
    return this.http.post<JobOperationTimerResult>(
      `${environment.apiUrl}/jobs/${jobId}/operations/${operationId}/timer/start`, { entryType }, this.silent());
  }

  stopOperationTimer(jobId: number, operationId: number): Observable<JobOperationTimerStopResult> {
    return this.http.post<JobOperationTimerStopResult>(
      `${environment.apiUrl}/jobs/${jobId}/operations/${operationId}/timer/stop`, { notes: null }, this.silent());
  }

  updateOperationProgress(
    jobId: number, operationId: number, request: UpdateJobOperationProgressRequest,
  ): Observable<JobOperationProgressResult> {
    return this.http.patch<JobOperationProgressResult>(
      `${environment.apiUrl}/jobs/${jobId}/operations/${operationId}`, request, this.silent());
  }

  completeJob(jobId: number): Observable<{ stageName: string }> {
    return this.http.post<{ stageName: string }>(`${this.base}/complete-job`, { jobId });
  }

  getJobStatus(jobId: number): Observable<JobStatus> {
    return this.http.get<JobStatus>(`${this.base}/jobs/${jobId}/status`);
  }

  advanceJob(jobId: number): Observable<JobAdvanceResult> {
    return this.http.post<JobAdvanceResult>(`${this.base}/jobs/${jobId}/advance`, {});
  }

  // Teams
  getTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.base}/teams`);
  }

  createTeam(name: string, color?: string, description?: string): Observable<Team> {
    return this.http.post<Team>(`${this.base}/teams`, { name, color, description });
  }

  // Terminal
  getTerminal(deviceToken: string): Observable<KioskTerminal> {
    return this.http.get<KioskTerminal>(`${this.base}/terminal`, {
      params: { deviceToken },
    });
  }

  setupTerminal(name: string, deviceToken: string, teamId: number): Observable<KioskTerminal> {
    return this.http.post<KioskTerminal>(`${this.base}/terminal`, { name, deviceToken, teamId });
  }

  private silent(): { context: HttpContext } {
    return { context: new HttpContext().set(SILENT_HTTP_ERRORS, true) };
  }
}
