import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateMaintenanceScheduleRequest,
  LogMaintenanceRequest,
  MaintenanceSchedule,
} from '../models/maintenance-schedule.model';

@Injectable({ providedIn: 'root' })
export class MaintenanceSchedulesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/assets`;

  list(): Observable<MaintenanceSchedule[]> {
    return this.http.get<MaintenanceSchedule[]>(`${this.base}/maintenance`);
  }

  create(request: CreateMaintenanceScheduleRequest): Observable<MaintenanceSchedule> {
    return this.http.post<MaintenanceSchedule>(`${this.base}/${request.assetId}/maintenance`, request);
  }

  logService(scheduleId: number, request: LogMaintenanceRequest): Observable<unknown> {
    return this.http.post(`${this.base}/maintenance/${scheduleId}/log`, request);
  }

  createJob(scheduleId: number): Observable<{ jobId: number }> {
    return this.http.post<{ jobId: number }>(`${this.base}/maintenance/${scheduleId}/create-job`, {});
  }
}
