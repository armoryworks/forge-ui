import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AdminDevice, EnrollmentToken } from '../models/device.model';

@Injectable({ providedIn: 'root' })
export class DeviceAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/devices`;

  createEnrollmentToken(targetUserId: number | null): Observable<EnrollmentToken> {
    return this.http.post<EnrollmentToken>(`${this.baseUrl}/enrollment-tokens`,
      targetUserId === null ? { targetUserId: 0, isShared: true } : { targetUserId });
  }

  listDevices(userId?: number, sharedOnly = false): Observable<AdminDevice[]> {
    let params = new HttpParams();
    if (userId != null) params = params.set('userId', userId);
    if (sharedOnly) params = params.set('shared', true);
    return this.http.get<AdminDevice[]>(this.baseUrl, { params });
  }

  revokeDevice(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/revoke`, {});
  }
}
