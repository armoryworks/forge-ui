import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TimeEntry } from '../models/time-entry.model';
import { CreateTimeEntryRequest } from '../models/create-time-entry-request.model';
import { StartTimerRequest } from '../models/start-timer-request.model';
import { StopTimerRequest } from '../models/stop-timer-request.model';
import { UpdateTimeEntryRequest } from '../models/update-time-entry-request.model';
import { ClockEvent } from '../models/clock-event.model';
import { CreateClockEventRequest } from '../models/create-clock-event-request.model';
import { PayPeriod } from '../models/pay-period.model';
import { TimeCorrectionLog } from '../models/time-correction-log.model';
import { CorrectTimeEntryRequest } from '../models/correct-time-entry-request.model';

@Injectable({ providedIn: 'root' })
export class TimeTrackingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/time-tracking`;

  getTimeEntries(userId?: number, jobId?: number, from?: string, to?: string): Observable<TimeEntry[]> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    if (jobId) params = params.set('jobId', jobId);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<TimeEntry[]>(`${this.base}/entries`, { params });
  }

  createTimeEntry(request: CreateTimeEntryRequest): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(`${this.base}/entries`, request);
  }

  updateTimeEntry(id: number, request: UpdateTimeEntryRequest): Observable<TimeEntry> {
    return this.http.patch<TimeEntry>(`${this.base}/entries/${id}`, request);
  }

  startTimer(request: StartTimerRequest): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(`${this.base}/timer/start`, request);
  }

  stopTimer(request: StopTimerRequest): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(`${this.base}/timer/stop`, request);
  }

  getClockEvents(userId?: number, from?: string, to?: string): Observable<ClockEvent[]> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<ClockEvent[]>(`${this.base}/clock-events`, { params });
  }

  createClockEvent(request: CreateClockEventRequest): Observable<ClockEvent> {
    return this.http.post<ClockEvent>(`${this.base}/clock-events`, request);
  }

  deleteTimeEntry(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/entries/${id}`);
  }

  getCurrentPayPeriod(): Observable<PayPeriod> {
    return this.http.get<PayPeriod>(`${this.base}/pay-period`);
  }

  updatePayPeriodSettings(type: string, anchorDate?: string): Observable<void> {
    return this.http.put<void>(`${this.base}/pay-period/settings`, { type, anchorDate });
  }

  correctTimeEntry(id: number, request: CorrectTimeEntryRequest): Observable<TimeEntry> {
    return this.http.patch<TimeEntry>(`${this.base}/entries/${id}/correct`, request);
  }

  getCorrections(userId?: number, from?: string, to?: string): Observable<TimeCorrectionLog[]> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<TimeCorrectionLog[]>(`${this.base}/corrections`, { params });
  }
}
