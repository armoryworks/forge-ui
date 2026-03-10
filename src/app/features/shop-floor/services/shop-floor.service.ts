import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ShopFloorOverview } from '../models/shop-floor-overview.model';
import { ClockWorker } from '../models/clock-worker.model';

@Injectable({ providedIn: 'root' })
export class ShopFloorService {
  private readonly http = inject(HttpClient);

  getOverview(): Observable<ShopFloorOverview> {
    return this.http.get<ShopFloorOverview>('/api/v1/display/shop-floor');
  }

  getClockStatus(): Observable<ClockWorker[]> {
    return this.http.get<ClockWorker[]>('/api/v1/display/shop-floor/clock-status');
  }

  clockInOut(userId: number, eventType: 'ClockIn' | 'ClockOut'): Observable<void> {
    return this.http.post<void>('/api/v1/display/shop-floor/clock', { userId, eventType });
  }
}
