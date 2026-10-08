import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { Observable, catchError, map, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { JobOperationEntryType } from '../models/job-operation-entry-type.type';
import { JobOperationProgressResult } from '../models/job-operation-progress-result.model';
import { JobOperationTimerResult } from '../models/job-operation-timer-result.model';
import { JobOperationTimerStopResult } from '../models/job-operation-timer-stop-result.model';
import { JobOperations } from '../models/job-operations.model';
import { JobOperationsConfig } from '../models/job-operations-config.model';
import { StartJobOperationTimerRequest } from '../models/start-job-operation-timer-request.model';
import { UpdateJobOperationProgressRequest } from '../models/update-job-operation-progress-request.model';

@Injectable({ providedIn: 'root' })
export class JobOperationsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  private readonly _trackingEnabled = signal(false);
  private configLoaded = false;

  readonly trackingEnabled = this._trackingEnabled.asReadonly();

  loadConfig(force = false): Observable<boolean> {
    if (this.configLoaded && !force) return of(this._trackingEnabled());
    return this.http.get<JobOperationsConfig>(`${this.base}/job-operations/config`).pipe(
      map(config => config?.operationTracking === true),
      catchError(() => of(false)),
      tap(enabled => {
        this.configLoaded = true;
        this._trackingEnabled.set(enabled);
      }),
    );
  }

  getOperations(jobId: number): Observable<JobOperations> {
    return this.http.get<JobOperations>(`${this.base}/jobs/${jobId}/operations`);
  }

  startTimer(jobId: number, operationId: number, entryType: JobOperationEntryType = 'Run'): Observable<JobOperationTimerResult> {
    const body: StartJobOperationTimerRequest = { entryType };
    return this.http.post<JobOperationTimerResult>(
      `${this.base}/jobs/${jobId}/operations/${operationId}/timer/start`, body);
  }

  stopTimer(jobId: number, operationId: number, notes?: string): Observable<JobOperationTimerStopResult> {
    return this.http.post<JobOperationTimerStopResult>(
      `${this.base}/jobs/${jobId}/operations/${operationId}/timer/stop`, { notes: notes ?? null });
  }

  updateProgress(jobId: number, operationId: number, request: UpdateJobOperationProgressRequest): Observable<JobOperationProgressResult> {
    return this.http.patch<JobOperationProgressResult>(
      `${this.base}/jobs/${jobId}/operations/${operationId}`, request);
  }
}
