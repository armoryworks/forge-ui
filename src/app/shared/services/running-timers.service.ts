import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TimeEntry } from '../../features/time-tracking/models/time-entry.model';
import { StopTimerRequest } from '../../features/time-tracking/models/stop-timer-request.model';

@Injectable({ providedIn: 'root' })
export class RunningTimersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/time-tracking`;

  getMine(): Observable<TimeEntry[]> {
    return this.http.get<TimeEntry[]>(`${this.base}/timers/active`);
  }

  stop(timeEntryId: number, notes?: string): Observable<TimeEntry> {
    const body: StopTimerRequest = { timeEntryId };
    if (notes) body.notes = notes;
    return this.http.post<TimeEntry>(`${this.base}/timer/stop`, body);
  }
}
