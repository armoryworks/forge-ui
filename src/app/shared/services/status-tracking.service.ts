import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { StatusEntry } from '../models/status-entry.model';
import { ActiveStatus } from '../models/active-status.model';
import { SetStatusRequest } from '../models/set-status-request.model';
import { AddHoldRequest } from '../models/add-hold-request.model';
import { ReleaseHoldRequest } from '../models/release-hold-request.model';

@Injectable({ providedIn: 'root' })
export class StatusTrackingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/status-tracking`;

  getHistory(entityType: string, entityId: number): Observable<StatusEntry[]> {
    return this.http.get<StatusEntry[]>(`${this.apiUrl}/${entityType}/${entityId}/history`);
  }

  getActiveStatus(entityType: string, entityId: number): Observable<ActiveStatus> {
    return this.http.get<ActiveStatus>(`${this.apiUrl}/${entityType}/${entityId}/active`);
  }

  setWorkflowStatus(entityType: string, entityId: number, request: SetStatusRequest): Observable<StatusEntry> {
    return this.http.post<StatusEntry>(`${this.apiUrl}/${entityType}/${entityId}/workflow`, request);
  }

  addHold(entityType: string, entityId: number, request: AddHoldRequest): Observable<StatusEntry> {
    return this.http.post<StatusEntry>(`${this.apiUrl}/${entityType}/${entityId}/holds`, request);
  }

  releaseHold(holdId: number, request?: ReleaseHoldRequest): Observable<StatusEntry> {
    return this.http.post<StatusEntry>(`${this.apiUrl}/holds/${holdId}/release`, request ?? {});
  }
}
