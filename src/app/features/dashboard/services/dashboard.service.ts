import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardData } from '../models/dashboard-data.model';
import { DashboardLayout } from '../models/dashboard-layout.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${environment.apiUrl}/dashboard`);
  }

  getDefaultLayout(): Observable<DashboardLayout> {
    return this.http.get<DashboardLayout>(`${environment.apiUrl}/dashboard/layout`);
  }
}
