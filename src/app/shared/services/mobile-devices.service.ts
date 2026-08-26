import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { MobileDevice } from '../models/mobile-device.model';

/** The signed-in person's enrolled devices, for the Account screen. */
@Injectable({ providedIn: 'root' })
export class MobileDevicesService {
  private readonly http = inject(HttpClient);

  mine(): Observable<MobileDevice[]> {
    return this.http.get<MobileDevice[]>('/api/v1/devices/mine');
  }

  /** Signs that device out everywhere: its refresh family and sessions die; it wipes on next contact. */
  revoke(id: number): Observable<unknown> {
    return this.http.post(`/api/v1/devices/${id}/revoke`, {});
  }

  reportProblem(report: { message: string; screen: string | null; appVersion: string | null; platform: string | null }): Observable<unknown> {
    return this.http.post('/api/v1/mobile/problem-reports', report);
  }
}
