import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';

import { Observable, catchError, from, map, of, tap } from 'rxjs';

import {
  ActiveTimer, ClockPunchResult, ClockState, JobAdvanceResult, JobNote, JobStatus, OnHand, QueuedOffline,
  ScanResolveResult, StartedTimeEntry, StockMoveRequest, StockMoveResult, UploadedJobFile,
} from '../models/mobile-api.model';
import { JobOperationProgress } from '../models/job-operation-progress.model';
import { JobOperationTimerResult } from '../models/job-operation-timer-result.model';
import { JobOperationTimerStop } from '../models/job-operation-timer-stop.model';
import { JobOperations } from '../models/job-operations.model';
import { JobOperationsConfig } from '../models/job-operations-config.model';
import { MyJob } from '../models/my-job.model';
import { QueuedActionLabel } from '../models/queued-action-label.model';
import { RunningTimer } from '../models/running-timer.model';
import { TimerStopTarget } from '../models/timer-stop-target.model';
import { UpdateJobOperationProgressRequest } from '../models/update-job-operation-progress-request.model';
import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';
import { InstanceService } from './instance.service';
import { OfflineQueueService } from './offline-queue.service';
import { PlatformService } from './platform.service';

type Method = 'POST' | 'PATCH' | 'DELETE';

/**
 * The shell's API surface. Every mutation carries a fresh Idempotency-Key
 * (the server replays stored results for retries) and exposes its
 * compensating action so the undo toast can reverse it with the same
 * scheme. Offline, a mutation goes to the per-instance queue with that
 * same key and resolves to `QueuedOffline`; lookups stay online-only.
 * A compensation sent with an explicit token never queues: the queue
 * replays under whoever holds the session at sync time. A queued change is
 * named by a translation key and the job or part number this service last
 * read for that id on the same instance, so the sync sheet never shows an id.
 */
@Injectable({ providedIn: 'root' })
export class MobileApiService {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);
  private readonly instances = inject(InstanceService);
  private readonly platform = inject(PlatformService);
  private readonly jobNumbers = new Map<string, string>();
  private readonly partNumbers = new Map<string, string>();

  resolveScan(code: string): Observable<ScanResolveResult> {
    return this.http.post<ScanResolveResult>('/api/v1/mobile/scan/resolve', { code })
      .pipe(tap((result) => this.rememberResult(result)));
  }

  jobStatus(jobId: number): Observable<JobStatus> {
    return this.http.get<JobStatus>(`/api/v1/mobile/jobs/${jobId}/status`)
      .pipe(tap((job) => this.jobNumbers.set(this.key(job.id), job.jobNumber)));
  }

  /** Open work orders assigned to the caller, due soonest first. */
  myJobs(): Observable<MyJob[]> {
    return this.http.get<MyJob[]>('/api/v1/mobile/jobs/mine')
      .pipe(tap((jobs) => jobs.forEach((job) => this.jobNumbers.set(this.key(job.id), job.jobNumber))));
  }

  /**
   * Moves the job to its next column. A column that can't be undone or that
   * creates an accounting document needs `confirmed`; without it the server
   * answers 400 with code `confirm-required`. A `silent` caller shows its
   * own message for a refusal.
   */
  advanceJob(
    jobId: number, scanCode: string | null, confirmed = false, silent = false,
  ): Observable<JobAdvanceResult | QueuedOffline> {
    return this.mutate<JobAdvanceResult>(
      'POST', `/api/v1/mobile/jobs/${jobId}/advance`, confirmed ? { scanCode, confirmed: true } : { scanCode },
      this.jobLabel('advance', jobId), undefined, silent);
  }

  /** Compensating action for advance: move back to the column it came from. */
  moveJobToStage(jobId: number, stageId: number, token?: string): Observable<JobStatus | QueuedOffline> {
    return this.mutate<JobStatus>(
      'PATCH', `/api/v1/jobs/${jobId}/stage`, { stageId }, this.jobLabel('moveBack', jobId), token);
  }

  /**
   * The caller's running timer, or null when none is running. A failure is
   * not shown: the caller keeps the timer it last knew about.
   */
  activeTimer(): Observable<ActiveTimer | null> {
    return this.http.get<ActiveTimer | null>('/api/v1/time-tracking/timer/active', {
      context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
    });
  }

  startTimer(jobId: number | null, token?: string, operationId: number | null = null): Observable<StartedTimeEntry | QueuedOffline> {
    return this.mutate<StartedTimeEntry>(
      'POST', '/api/v1/time-tracking/timer/start', { jobId, operationId },
      jobId === null ? { key: 'mobileAppWork.sync.action.startTimerAny' } : this.jobLabel('startTimer', jobId), token);
  }

  /** Without a target the server stops the caller's newest job-level timer, as it always has. */
  stopTimer(token?: string, target?: TimerStopTarget): Observable<unknown> {
    return this.mutate<unknown>('POST', '/api/v1/time-tracking/timer/stop', target ?? {},
      { key: 'mobileAppWork.sync.action.stopTimer' }, token);
  }

  /** All of the caller's open timers, job-level and per operation. A failure is not shown. */
  activeTimers(): Observable<RunningTimer[]> {
    return this.http.get<RunningTimer[]>('/api/v1/time-tracking/timers/active', {
      context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
    });
  }

  /** Whether operation tracking is switched on. A refusal is not shown: the caller treats it as off. */
  operationsConfig(): Observable<JobOperationsConfig> {
    return this.http.get<JobOperationsConfig>('/api/v1/job-operations/config', {
      context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
    });
  }

  jobOperations(jobId: number): Observable<JobOperations> {
    return this.http.get<JobOperations>(`/api/v1/jobs/${jobId}/operations`, {
      context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
    });
  }

  startOperationTimer(
    jobId: number, operationId: number, entryType: 'Run' | 'Setup' = 'Run', token?: string,
  ): Observable<JobOperationTimerResult | QueuedOffline> {
    return this.mutate<JobOperationTimerResult>(
      'POST', `/api/v1/jobs/${jobId}/operations/${operationId}/timer/start`, { entryType },
      this.jobLabel('startOperation', jobId), token, true);
  }

  /** Also the compensating action for startOperationTimer. */
  stopOperationTimer(jobId: number, operationId: number, token?: string): Observable<JobOperationTimerStop | QueuedOffline> {
    return this.mutate<JobOperationTimerStop>(
      'POST', `/api/v1/jobs/${jobId}/operations/${operationId}/timer/stop`, {},
      this.jobLabel('stopOperation', jobId), token, true);
  }

  /** Quantities are absolute, so the same call with the earlier values is the compensating action. */
  updateOperationProgress(
    jobId: number, operationId: number, request: UpdateJobOperationProgressRequest, token?: string,
  ): Observable<JobOperationProgress | QueuedOffline> {
    return this.mutate<JobOperationProgress>(
      'PATCH', `/api/v1/jobs/${jobId}/operations/${operationId}`, request,
      this.jobLabel('updateOperation', jobId), token, true);
  }

  /**
   * Compensating action for startTimer: removes the entry so no zero-minute
   * row is kept. A refusal is not shown, since the caller falls back to
   * stopping the timer.
   */
  deleteTimeEntry(entryId: number, token?: string): Observable<unknown> {
    return this.mutate<unknown>(
      'DELETE', `/api/v1/time-tracking/entries/${entryId}`, null,
      { key: 'mobileAppWork.sync.action.removeTimeEntry' }, token, true);
  }

  addNote(jobId: number, text: string): Observable<JobNote | QueuedOffline> {
    return this.mutate<JobNote>('POST', `/api/v1/jobs/${jobId}/notes`, { text }, this.jobLabel('addNote', jobId));
  }

  /** Compensating action for addNote. */
  deleteNote(jobId: number, noteId: number): Observable<unknown> {
    return this.mutate<unknown>(
      'DELETE', `/api/v1/jobs/${jobId}/notes/${noteId}`, null, this.jobLabel('removeNote', jobId));
  }

  attachPhoto(jobId: number, blob: Blob, fileName: string): Observable<UploadedJobFile> {
    const form = new FormData();
    form.append('file', blob, fileName);
    return this.http.post<UploadedJobFile>(
      `/api/v1/jobs/${jobId}/files`, form, { headers: this.idempotent() });
  }

  /** Compensating action for attachPhoto. */
  deleteFile(fileId: number): Observable<unknown> {
    return this.http.delete(`/api/v1/files/${fileId}`, { headers: this.idempotent() });
  }

  /**
   * The caller's clock state. A caller that treats a failure as "nothing to
   * show" passes `silent` to keep the refusal off the global error surface.
   */
  clockState(silent = false): Observable<ClockState> {
    return this.http.get<ClockState>('/api/v1/mobile/clock/state', {
      context: new HttpContext().set(SILENT_HTTP_ERRORS, silent),
    });
  }

  clockPunch(eventType: 'ClockIn' | 'ClockOut' | 'BreakStart' | 'BreakEnd'): Observable<ClockPunchResult | QueuedOffline> {
    return this.mutate<ClockPunchResult>(
      'POST', '/api/v1/mobile/clock/punch', { eventType }, { key: `mobileAppWork.sync.action.clock.${eventType}` });
  }

  /**
   * Compensating action for clockPunch (own latest event, inside the window).
   * A shared device passes the token of the person who punched, since their
   * session has already left the device. A caller that shows its own failure
   * message passes `silent` to keep the refusal off the global error surface.
   */
  undoClockPunch(eventId: number, token?: string, silent = false): Observable<ClockState | QueuedOffline> {
    return this.mutate<ClockState>(
      'DELETE', `/api/v1/mobile/clock/events/${eventId}`, null, { key: 'mobileAppWork.sync.action.undoClockPunch' }, token, silent);
  }

  onHand(partId: number, locationId: number): Observable<OnHand> {
    return this.http.get<OnHand>('/api/v1/mobile/stock/on-hand', { params: { partId, locationId } })
      .pipe(tap((stock) => this.partNumbers.set(this.key(stock.partId), stock.partNumber)));
  }

  /** Also the compensating action: call again with the result's `undo`. */
  moveStock(request: StockMoveRequest): Observable<StockMoveResult | QueuedOffline> {
    const part = this.partNumbers.get(this.key(request.partId));
    return this.mutate<StockMoveResult>(
      'POST', '/api/v1/mobile/stock/move', request, part
        ? { key: 'mobileAppWork.sync.action.moveStock', params: { quantity: request.quantity, part } }
        : { key: 'mobileAppWork.sync.action.moveStockAny', params: { quantity: request.quantity } });
  }

  lookup(term: string): Observable<ScanResolveResult[]> {
    return this.http.get<ScanResolveResult[]>('/api/v1/mobile/lookup', { params: { q: term } })
      .pipe(tap((results) => results.forEach((result) => this.rememberResult(result))));
  }

  /** Canned floor notes from reference data (group mobile_note_presets); empty when none configured. */
  notePresets(): Observable<string[]> {
    return this.http.get<{ label: string; isActive: boolean }[] | { data: { label: string; isActive: boolean }[] }>(
      '/api/v1/reference-data/mobile_note_presets').pipe(
      map((res) => (Array.isArray(res) ? res : res.data ?? [])
        .filter((r) => r.isActive !== false).map((r) => r.label)),
      catchError(() => of([])),
    );
  }

  private rememberResult(result: ScanResolveResult): void {
    if (result.id === null) return;
    if (result.kind === 'job') this.jobNumbers.set(this.key(result.id), result.label);
    else if (result.kind === 'part') this.partNumbers.set(this.key(result.id), result.label);
  }

  private key(id: number): string {
    return `${this.instances.instance()?.id ?? ''}:${id}`;
  }

  private jobLabel(action: string, jobId: number): QueuedActionLabel {
    const job = this.jobNumbers.get(this.key(jobId));
    return job
      ? { key: `mobileAppWork.sync.action.${action}`, params: { job } }
      : { key: `mobileAppWork.sync.action.${action}Any` };
  }

  private mutate<T>(
    method: Method, url: string, body: unknown, label: QueuedActionLabel, token?: string, silent = false,
  ): Observable<T | QueuedOffline> {
    const headers = this.idempotentHeaders();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (this.platform.mobileShell && !navigator.onLine) {
      return from(this.queue.enqueue(method, url, body, undefined, {
        headers, instanceId: this.instances.instance()?.id ?? null, label,
      })).pipe(map((entryId) => ({ queued: true as const, entryId })));
    }
    const options = {
      headers: new HttpHeaders(headers),
      context: new HttpContext().set(SILENT_HTTP_ERRORS, silent),
    };
    switch (method) {
      case 'POST': return this.http.post<T>(url, body, options);
      case 'PATCH': return this.http.patch<T>(url, body, options);
      case 'DELETE': return this.http.delete<T>(url, options);
    }
  }

  private idempotent(): HttpHeaders {
    return new HttpHeaders(this.idempotentHeaders());
  }

  private idempotentHeaders(): Record<string, string> {
    return {
      'Idempotency-Key': crypto.randomUUID(),
      'X-Client-Timestamp': new Date().toISOString(),
    };
  }
}
