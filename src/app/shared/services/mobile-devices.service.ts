import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';

import { Observable } from 'rxjs';

import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';
import { MobileDevice } from '../models/mobile-device.model';

/** The signed-in person's enrolled devices, for the Account screen. */
@Injectable({ providedIn: 'root' })
export class MobileDevicesService {
  private readonly http = inject(HttpClient);

  /** A refusal is not shown here: Account says in place that the person has no access. */
  mine(): Observable<MobileDevice[]> {
    return this.http.get<MobileDevice[]>('/api/v1/devices/mine', {
      context: new HttpContext().set(SILENT_HTTP_ERRORS, true),
    });
  }

  /** Signs that device out everywhere: its refresh family and sessions die; it wipes on next contact. */
  revoke(id: number): Observable<unknown> {
    return this.http.post(`/api/v1/devices/${id}/revoke`, {});
  }

  reportProblem(report: { message: string; screen: string | null; appVersion: string | null; platform: string | null }): Observable<unknown> {
    return this.http.post('/api/v1/mobile/problem-reports', report);
  }
}
