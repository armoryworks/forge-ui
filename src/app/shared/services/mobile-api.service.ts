import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';

import { Observable, catchError, from, map, of } from 'rxjs';

import {
  ActiveTimer, ClockPunchResult, ClockState, JobAdvanceResult, JobNote, JobStatus, OnHand, QueuedOffline,
  ScanResolveResult, StartedTimeEntry, StockMoveRequest, StockMoveResult, UploadedJobFile,
} from '../models/mobile-api.model';
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
 * replays under whoever holds the session at sync time.
 */
@Injectable({ providedIn: 'root' })
export class MobileApiService {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);
  private readonly instances = inject(InstanceService);
  private readonly platform = inject(PlatformService);

  resolveScan(code: string): Observable<ScanResolveResult> {
    return this.http.post<ScanResolveResult>('/api/v1/mobile/scan/resolve', { code });
  }

  jobStatus(jobId: number): Observable<JobStatus> {
    return this.http.get<JobStatus>(`/api/v1/mobile/jobs/${jobId}/status`);
  }

  advanceJob(jobId: number, scanCode: string | null): Observable<JobAdvanceResult | QueuedOffline> {
    return this.mutate<JobAdvanceResult>('POST', `/api/v1/mobile/jobs/${jobId}/advance`, { scanCode }, `Advance job ${jobId}`);
  }

  /** Compensating action for advance: move back to the column it came from. */
  moveJobToStage(jobId: number, stageId: number, token?: string): Observable<JobStatus | QueuedOffline> {
    return this.mutate<JobStatus>('PATCH', `/api/v1/jobs/${jobId}/stage`, { stageId }, `Move job ${jobId} back`, token);
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
      jobId === null ? 'Start timer' : `Start timer on job ${jobId}`, token);
  }

  stopTimer(token?: string): Observable<unknown> {
    return this.mutate<unknown>('POST', '/api/v1/time-tracking/timer/stop', {}, 'Stop timer', token);
  }

  /**
   * Compensating action for startTimer: removes the entry so no zero-minute
   * row is kept. A refusal is not shown, since the caller falls back to
   * stopping the timer.
   */
  deleteTimeEntry(entryId: number, token?: string): Observable<unknown> {
    return this.mutate<unknown>(
      'DELETE', `/api/v1/time-tracking/entries/${entryId}`, null, `Remove time entry ${entryId}`, token, true);
  }

  addNote(jobId: number, text: string): Observable<JobNote | QueuedOffline> {
    return this.mutate<JobNote>('POST', `/api/v1/jobs/${jobId}/notes`, { text }, `Note on job ${jobId}`);
  }

  /** Compensating action for addNote. */
  deleteNote(jobId: number, noteId: number): Observable<unknown> {
    return this.mutate<unknown>('DELETE', `/api/v1/jobs/${jobId}/notes/${noteId}`, null, `Remove note on job ${jobId}`);
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

  clockState(): Observable<ClockState> {
    return this.http.get<ClockState>('/api/v1/mobile/clock/state');
  }

  clockPunch(eventType: 'ClockIn' | 'ClockOut' | 'BreakStart' | 'BreakEnd'): Observable<ClockPunchResult | QueuedOffline> {
    return this.mutate<ClockPunchResult>('POST', '/api/v1/mobile/clock/punch', { eventType }, `Clock: ${eventType}`);
  }

  /**
   * Compensating action for clockPunch (own latest event, inside the window).
   * A shared device passes the token of the person who punched, since their
   * session has already left the device.
   */
  undoClockPunch(eventId: number, token?: string): Observable<ClockState | QueuedOffline> {
    return this.mutate<ClockState>('DELETE', `/api/v1/mobile/clock/events/${eventId}`, null, 'Undo clock punch', token);
  }

  onHand(partId: number, locationId: number): Observable<OnHand> {
    return this.http.get<OnHand>('/api/v1/mobile/stock/on-hand', { params: { partId, locationId } });
  }

  /** Also the compensating action: call again with the result's `undo`. */
  moveStock(request: StockMoveRequest): Observable<StockMoveResult | QueuedOffline> {
    return this.mutate<StockMoveResult>(
      'POST', '/api/v1/mobile/stock/move', request, `Move ${request.quantity} of part ${request.partId}`);
  }

  lookup(term: string): Observable<ScanResolveResult[]> {
    return this.http.get<ScanResolveResult[]>('/api/v1/mobile/lookup', { params: { q: term } });
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

  private mutate<T>(
    method: Method, url: string, body: unknown, description: string, token?: string, silent = false,
  ): Observable<T | QueuedOffline> {
    const headers = this.idempotentHeaders();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (this.platform.mobileShell && !navigator.onLine) {
      return from(this.queue.enqueue(method, url, body, description, {
        headers, instanceId: this.instances.instance()?.id ?? null,
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
