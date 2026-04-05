import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ShopFloorOverview } from '../models/shop-floor-overview.model';
import { ClockWorker } from '../models/clock-worker.model';
import { KioskTerminal, Team } from '../models/kiosk-terminal.model';
import { ScanIdentification } from '../models/scan-identification.model';

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

  stopTimer(): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/time-tracking/timer/stop`, { notes: null });
  }

  completeJob(jobId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/complete-job`, { jobId });
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
}
