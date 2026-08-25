import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Observable, catchError, map, of } from 'rxjs';

import {
  ClockPunchResult, ClockState, JobAdvanceResult, JobNote, JobStatus, OnHand,
  ScanResolveResult, StockMoveRequest, StockMoveResult, UploadedJobFile,
} from '../models/mobile-api.model';

/**
 * The shell's API surface. Every mutation carries a fresh Idempotency-Key
 * (the server replays stored results for retries) and exposes its
 * compensating action so the undo toast can reverse it with the same
 * scheme.
 */
@Injectable({ providedIn: 'root' })
export class MobileApiService {
  private readonly http = inject(HttpClient);

  resolveScan(code: string): Observable<ScanResolveResult> {
    return this.http.post<ScanResolveResult>('/api/v1/mobile/scan/resolve', { code });
  }

  jobStatus(jobId: number): Observable<JobStatus> {
    return this.http.get<JobStatus>(`/api/v1/mobile/jobs/${jobId}/status`);
  }

  advanceJob(jobId: number, scanCode: string | null): Observable<JobAdvanceResult> {
    return this.http.post<JobAdvanceResult>(
      `/api/v1/mobile/jobs/${jobId}/advance`, { scanCode }, { headers: this.idempotent() });
  }

  /** Compensating action for advance: move back to the column it came from. */
  moveJobToStage(jobId: number, stageId: number): Observable<JobStatus> {
    return this.http.patch<JobStatus>(
      `/api/v1/jobs/${jobId}/stage`, { stageId }, { headers: this.idempotent() });
  }

  startTimer(jobId: number): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(
      '/api/v1/time-tracking/timer/start', { jobId }, { headers: this.idempotent() });
  }

  stopTimer(): Observable<unknown> {
    return this.http.post('/api/v1/time-tracking/timer/stop', {}, { headers: this.idempotent() });
  }

  addNote(jobId: number, text: string): Observable<JobNote> {
    return this.http.post<JobNote>(
      `/api/v1/jobs/${jobId}/notes`, { text }, { headers: this.idempotent() });
  }

  /** Compensating action for addNote. */
  deleteNote(jobId: number, noteId: number): Observable<unknown> {
    return this.http.delete(`/api/v1/jobs/${jobId}/notes/${noteId}`, { headers: this.idempotent() });
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

  clockPunch(eventType: 'ClockIn' | 'ClockOut' | 'BreakStart' | 'BreakEnd'): Observable<ClockPunchResult> {
    return this.http.post<ClockPunchResult>(
      '/api/v1/mobile/clock/punch', { eventType }, { headers: this.idempotent() });
  }

  /** Compensating action for clockPunch (own latest event, inside the window). */
  undoClockPunch(eventId: number): Observable<ClockState> {
    return this.http.delete<ClockState>(`/api/v1/mobile/clock/events/${eventId}`, { headers: this.idempotent() });
  }

  onHand(partId: number, locationId: number): Observable<OnHand> {
    return this.http.get<OnHand>('/api/v1/mobile/stock/on-hand', { params: { partId, locationId } });
  }

  /** Also the compensating action: call again with the result's `undo`. */
  moveStock(request: StockMoveRequest): Observable<StockMoveResult> {
    return this.http.post<StockMoveResult>('/api/v1/mobile/stock/move', request, { headers: this.idempotent() });
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

  private idempotent(): HttpHeaders {
    return new HttpHeaders({
      'Idempotency-Key': crypto.randomUUID(),
      'X-Client-Timestamp': new Date().toISOString(),
    });
  }
}
