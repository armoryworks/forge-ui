import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AdminDevice, EnrollmentToken } from '../models/device.model';

@Injectable({ providedIn: 'root' })
export class DeviceAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/devices`;

  createEnrollmentToken(targetUserId: number): Observable<EnrollmentToken> {
    return this.http.post<EnrollmentToken>(`${this.baseUrl}/enrollment-tokens`, { targetUserId });
  }

  listDevices(userId?: number): Observable<AdminDevice[]> {
    let params = new HttpParams();
    if (userId != null) params = params.set('userId', userId);
    return this.http.get<AdminDevice[]>(this.baseUrl, { params });
  }

  revokeDevice(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/revoke`, {});
  }
}
