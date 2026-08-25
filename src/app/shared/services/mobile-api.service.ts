import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Observable, catchError, map, of } from 'rxjs';

import {
  JobAdvanceResult, JobNote, JobStatus, ScanResolveResult, UploadedJobFile,
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
