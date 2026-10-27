import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ScanDevice } from '../models/scan-device.model';
import { ScanDeviceRequest } from '../models/scan-device-request.model';
import { UpdateScanDeviceRequest } from '../models/update-scan-device-request.model';

@Injectable({ providedIn: 'root' })
export class ScanDeviceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/scanner/devices`;

  list(): Observable<ScanDevice[]> {
    return this.http.get<ScanDevice[]>(this.base);
  }

  pair(request: ScanDeviceRequest): Observable<ScanDevice> {
    return this.http.post<ScanDevice>(this.base, request);
  }

  update(id: number, request: UpdateScanDeviceRequest): Observable<ScanDevice> {
    return this.http.put<ScanDevice>(`${this.base}/${id}`, request);
  }

  unpair(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
