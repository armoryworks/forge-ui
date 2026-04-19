import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ScanContext,
  ScanMoveRequest,
  ScanCountRequest,
  ScanReceiveRequest,
  ScanIssueRequest,
} from '../models/scan-action.model';
import { ScanLogEntry, ScanDevice } from '../models/scan-log.model';

@Injectable({ providedIn: 'root' })
export class ScanActionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/scanner`;

  getContext(partIdentifier: string): Observable<ScanContext> {
    return this.http.get<ScanContext>(`${this.base}/context/${encodeURIComponent(partIdentifier)}`);
  }

  move(request: ScanMoveRequest): Observable<number> {
    return this.http.post<number>(`${this.base}/move`, request);
  }

  count(request: ScanCountRequest): Observable<number> {
    return this.http.post<number>(`${this.base}/count`, request);
  }

  receive(request: ScanReceiveRequest): Observable<number> {
    return this.http.post<number>(`${this.base}/receive`, request);
  }

  issue(request: ScanIssueRequest): Observable<number> {
    return this.http.post<number>(`${this.base}/issue`, request);
  }

  reverseScanAction(logId: number, pin: string): Observable<void> {
    return this.http.post<void>(`${this.base}/reverse`, {
      scanActionLogId: logId,
      pin,
    });
  }

  getScanLog(userId?: number, date?: string, actionType?: string): Observable<ScanLogEntry[]> {
    let params = new HttpParams();
    if (userId != null) params = params.set('userId', userId);
    if (date) params = params.set('date', date);
    if (actionType) params = params.set('actionType', actionType);
    return this.http.get<ScanLogEntry[]>(`${this.base}/log`, { params });
  }

  getDevices(): Observable<ScanDevice[]> {
    return this.http.get<ScanDevice[]>(`${this.base}/devices`);
  }

  pairDevice(deviceId: string, deviceName?: string): Observable<ScanDevice> {
    return this.http.post<ScanDevice>(`${this.base}/devices`, {
      deviceId,
      deviceName: deviceName ?? null,
    });
  }

  unpairDevice(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/devices/${id}`);
  }
}
