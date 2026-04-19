import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ScanDevice, ScanActivityItem } from '../models/scan-device.model';

@Injectable({ providedIn: 'root' })
export class ScanDeviceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/shop-floor/scan-devices`;

  getDevices(): Observable<ScanDevice[]> {
    return this.http.get<ScanDevice[]>(this.base);
  }

  pairDevice(deviceId: string, userId: number): Observable<ScanDevice> {
    return this.http.post<ScanDevice>(this.base, { deviceId, userId });
  }

  unpairDevice(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  selfPair(deviceId: string): Observable<ScanDevice> {
    return this.http.post<ScanDevice>(`${this.base}/self-pair`, { deviceId });
  }

  getRecentActivity(): Observable<ScanActivityItem[]> {
    return this.http.get<ScanActivityItem[]>(`${this.base}/activity`);
  }
}
