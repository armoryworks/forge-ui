import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';
import { RunningTimer } from '../../../shared/models/running-timer.model';
import { elapsedMs } from '../../../shared/utils/elapsed-ms';

@Injectable({ providedIn: 'root' })
export class MobileRunningTimersService {
  private readonly http = inject(HttpClient);

  private readonly _timers = signal<RunningTimer[]>([]);
  readonly timers = this._timers.asReadonly();

  load(): void {
    this.http.get<RunningTimer[] | null>('/api/v1/time-tracking/timers/active', {
      context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
    }).subscribe({
      next: (timers) => this._timers.set(timers ?? []),
      error: () => this._timers.set([]),
    });
  }

  clear(): void {
    this._timers.set([]);
  }

  onJob(jobId: number): RunningTimer[] {
    return this._timers().filter((t) => t.jobId === jobId);
  }

  elapsed(timer: RunningTimer, nowMs: number): string {
    const seconds = Math.floor(elapsedMs(timer.timerStart, nowMs) / 1000);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  }
}
